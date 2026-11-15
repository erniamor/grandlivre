import type {
	CreateRecurringTransaction,
	Paginated,
	RecurrenceSchedule,
	RecurringTransaction,
	TransactionLineInput,
	UpdateRecurringTransaction,
} from "@repo/schemas";
import {
	and,
	asc,
	count,
	eq,
	type InferSelectModel,
	inArray,
	or,
	sql,
} from "drizzle-orm";
import { db, type Transaction as Tx } from "@/db/client";
import {
	recurringTransactionLines,
	recurringTransactions,
	users,
} from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { publishHouseholdEvent } from "@/lib/events";
import { offsetOf } from "@/lib/pagination";
import type { Viewer } from "@/routes/accounts/accounts.service";
import type { RecurringQuery } from "@/routes/recurring/recurring.schemas";
import { nextOccurrence } from "@/routes/recurring/schedule";
import {
	type AccountAccess,
	accountAccess,
	assertAccount,
	type Database,
	isVisible,
	toValues,
} from "@/routes/transactions/transactions.service";

type RecurringRow = InferSelectModel<typeof recurringTransactions>;
type LineRow = InferSelectModel<typeof recurringTransactionLines>;

function notFound(): AppError {
	return new AppError(404, "not_found", "Recurring transaction not found");
}

function toRecurring(
	row: RecurringRow,
	lines: LineRow[],
	creator: { name: string; email: string } | null,
): RecurringTransaction {
	return {
		id: row.id,
		householdId: row.householdId,
		transaction: {
			type: row.type,
			accountId: row.accountId,
			toAccountId: row.toAccountId,
			amount: row.amount,
			payee: row.payee,
			note: row.note,
			lines: lines.map((line) => ({ amount: line.amount, tagId: line.tagId })),
		},
		schedule: {
			unit: row.unit,
			interval: row.interval,
			startDate: row.startDate,
			endDate: row.endDate,
		},
		mode: row.mode,
		nextDate: row.nextDate,
		createdBy:
			row.createdBy && creator
				? { userId: row.createdBy, name: creator.name || creator.email }
				: null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

/** The recurring transactions with their lines, in entry order, and who created them. */
async function withDetails(
	database: Database,
	rows: RecurringRow[],
): Promise<RecurringTransaction[]> {
	if (rows.length === 0) {
		return [];
	}
	const creatorIds = [
		...new Set(rows.flatMap((row) => (row.createdBy ? [row.createdBy] : []))),
	];
	const [lines, creators] = await Promise.all([
		database
			.select()
			.from(recurringTransactionLines)
			.where(
				inArray(
					recurringTransactionLines.recurringId,
					rows.map((row) => row.id),
				),
			)
			.orderBy(asc(recurringTransactionLines.position)),
		creatorIds.length === 0
			? []
			: database
					.select({ id: users.id, name: users.name, email: users.email })
					.from(users)
					.where(inArray(users.id, creatorIds)),
	]);
	const creatorById = new Map(creators.map((creator) => [creator.id, creator]));
	return rows.map((row) =>
		toRecurring(
			row,
			lines.filter((line) => line.recurringId === row.id),
			(row.createdBy && creatorById.get(row.createdBy)) || null,
		),
	);
}

/**
 * The recurring transactions of the household the viewer may see, the next
 * due first, the ended ones last: those of the accounts whose details they see.
 */
export async function listRecurring(
	viewer: Viewer,
	pagination: RecurringQuery,
): Promise<Paginated<RecurringTransaction>> {
	const access = await accountAccess(db, viewer);
	const visibleIds = [...access]
		.filter(([, account]) => account.seesDetails)
		.map(([id]) => id);
	if (visibleIds.length === 0) {
		return { data: [], pagination: { ...pagination, total: 0 } };
	}
	const where = and(
		eq(recurringTransactions.householdId, viewer.membership.household.id),
		or(
			inArray(recurringTransactions.accountId, visibleIds),
			inArray(recurringTransactions.toAccountId, visibleIds),
		),
	);
	const [rows, [counted]] = await Promise.all([
		db
			.select()
			.from(recurringTransactions)
			.where(where)
			.orderBy(
				sql`${recurringTransactions.nextDate} asc nulls last`,
				asc(recurringTransactions.createdAt),
				asc(recurringTransactions.id),
			)
			.limit(pagination.pageSize)
			.offset(offsetOf(pagination)),
		db.select({ total: count() }).from(recurringTransactions).where(where),
	]);
	return {
		data: await withDetails(db, rows),
		pagination: { ...pagination, total: counted?.total ?? 0 },
	};
}

export async function getRecurring(
	viewer: Viewer,
	recurringId: string,
): Promise<RecurringTransaction> {
	const [[row], access] = await Promise.all([
		db
			.select()
			.from(recurringTransactions)
			.where(
				and(
					eq(recurringTransactions.id, recurringId),
					eq(recurringTransactions.householdId, viewer.membership.household.id),
				),
			),
		accountAccess(db, viewer),
	]);
	if (!row || !isVisible(row, access)) {
		throw notFound();
	}
	const [recurring] = await withDetails(db, [row]);
	if (!recurring) {
		throw notFound();
	}
	return recurring;
}

/**
 * When the recurring transaction comes next. A new schedule starts on its
 * first day, which can't be past in the household's time zone; an unchanged
 * one keeps its next day, unless its new end comes before.
 */
function scheduleValues(
	viewer: Viewer,
	schedule: RecurrenceSchedule,
	previous?: RecurringRow,
) {
	const today = todayIn(viewer.membership.household.timeZone);
	const changed =
		!previous ||
		previous.unit !== schedule.unit ||
		previous.interval !== schedule.interval ||
		previous.startDate !== schedule.startDate;
	if (changed && schedule.startDate < today) {
		throw new AppError(422, "validation_error", "Invalid request", [
			{ field: "schedule.startDate", message: "recurrence_start_in_past" },
		]);
	}
	const next = changed
		? schedule.startDate
		: (previous.nextDate ?? nextOccurrence(schedule, today));
	return {
		...schedule,
		nextDate:
			next !== null && schedule.endDate !== null && next > schedule.endDate
				? null
				: next,
	};
}

/**
 * The columns of what the recurring transaction records, checked as a
 * transaction on its first day would be; errors point into `transaction`.
 */
async function templateValues(
	tx: Tx,
	viewer: Viewer,
	access: Map<string, AccountAccess>,
	{ transaction, schedule }: UpdateRecurringTransaction,
) {
	try {
		const { date: _date, ...values } = await toValues(tx, viewer, access, {
			...transaction,
			date: schedule.startDate,
		});
		return values;
	} catch (error) {
		if (error instanceof AppError && Array.isArray(error.details)) {
			throw new AppError(
				error.status,
				error.code,
				error.message,
				error.details.map((detail: { field: string; message: string }) => ({
					...detail,
					field: `transaction.${detail.field}`,
				})),
			);
		}
		throw error;
	}
}

async function insertLines(
	tx: Tx,
	householdId: string,
	recurringId: string,
	lines: TransactionLineInput[],
): Promise<void> {
	if (lines.length === 0) {
		return;
	}
	await tx.insert(recurringTransactionLines).values(
		lines.map((line, position) => ({
			recurringId,
			householdId,
			position,
			amount: line.amount,
			tagId: line.tagId ?? null,
		})),
	);
}

/** Creates a recurring transaction on an account the viewer holds. */
export async function createRecurring(
	viewer: Viewer,
	input: CreateRecurringTransaction,
): Promise<RecurringTransaction> {
	const householdId = viewer.membership.household.id;
	return db.transaction(async (tx) => {
		const access = await accountAccess(tx, viewer);
		const { lines, ...values } = await templateValues(
			tx,
			viewer,
			access,
			input,
		);
		const [row] = await tx
			.insert(recurringTransactions)
			.values({
				...values,
				...scheduleValues(viewer, input.schedule),
				householdId,
				mode: input.mode ?? "confirm",
				createdBy: viewer.userId,
			})
			.returning();
		if (!row) {
			throw new Error("The recurring transaction was not created");
		}
		await insertLines(tx, householdId, row.id, lines);
		await publishHouseholdEvent(tx, householdId, "recurring");
		const [recurring] = await withDetails(tx, [row]);
		if (!recurring) {
			throw new Error("The recurring transaction was not created");
		}
		return recurring;
	});
}

/**
 * Locks a recurring transaction the viewer may change: they see it and hold
 * its account.
 */
async function lockForChange(
	tx: Tx,
	viewer: Viewer,
	access: Map<string, AccountAccess>,
	recurringId: string,
): Promise<RecurringRow> {
	const [row] = await tx
		.select()
		.from(recurringTransactions)
		.where(
			and(
				eq(recurringTransactions.id, recurringId),
				eq(recurringTransactions.householdId, viewer.membership.household.id),
			),
		)
		.for("update");
	if (!row || !isVisible(row, access)) {
		throw notFound();
	}
	if (!access.get(row.accountId)?.isHolder) {
		throw new AppError(
			403,
			"forbidden",
			"Only a holder of the account can change its recurring transactions",
		);
	}
	return row;
}

/**
 * Replaces a recurring transaction: what it records next, and when. The
 * transactions it already recorded stay as they are.
 */
export async function updateRecurring(
	viewer: Viewer,
	recurringId: string,
	input: UpdateRecurringTransaction,
): Promise<RecurringTransaction> {
	const householdId = viewer.membership.household.id;
	return db.transaction(async (tx) => {
		const access = await accountAccess(tx, viewer);
		const previous = await lockForChange(tx, viewer, access, recurringId);
		// Not on an archived account, which takes no new transaction
		assertAccount(access, previous.accountId, "accountId");
		const { lines, ...values } = await templateValues(
			tx,
			viewer,
			access,
			input,
		);
		const [row] = await tx
			.update(recurringTransactions)
			.set({
				...values,
				...scheduleValues(viewer, input.schedule, previous),
				mode: input.mode ?? "confirm",
			})
			.where(eq(recurringTransactions.id, recurringId))
			.returning();
		if (!row) {
			throw notFound();
		}
		await tx
			.delete(recurringTransactionLines)
			.where(eq(recurringTransactionLines.recurringId, recurringId));
		await insertLines(tx, householdId, recurringId, lines);
		await publishHouseholdEvent(tx, householdId, "recurring");
		const [recurring] = await withDetails(tx, [row]);
		if (!recurring) {
			throw notFound();
		}
		return recurring;
	});
}

/** Deletes a recurring transaction; the transactions it recorded stay. */
export async function deleteRecurring(
	viewer: Viewer,
	recurringId: string,
): Promise<void> {
	await db.transaction(async (tx) => {
		const access = await accountAccess(tx, viewer);
		await lockForChange(tx, viewer, access, recurringId);
		await tx
			.delete(recurringTransactions)
			.where(eq(recurringTransactions.id, recurringId));
		await publishHouseholdEvent(
			tx,
			viewer.membership.household.id,
			"recurring",
		);
	});
}
