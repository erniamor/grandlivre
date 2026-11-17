import {
	type Paginated,
	type RecurringSuggestion,
	type RecurringSuggestionKey,
	SUGGESTION_MAX_DATES,
} from "@repo/schemas";
import { and, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import { db } from "@/db/client";
import {
	recurringDismissals,
	recurringTransactions,
	transactionLines,
	transactions,
} from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { publishHouseholdEvent } from "@/lib/events";
import { offsetOf, type PaginationQuery } from "@/lib/pagination";
import type { Viewer } from "@/routes/accounts/accounts.service";
import { descriptionKey } from "@/routes/imports/statements/fingerprint";
import {
	type CoveredSchedule,
	findRecurringPatterns,
	type PastTransaction,
} from "@/routes/recurring/recurring-patterns";
import { accountAccess } from "@/routes/transactions/transactions.service";

/** How far back the history is read for series, in months. */
export const SUGGESTION_HISTORY_MONTHS = 18;

/** The day `months` months before `day` (the 1st of that month: whole months). */
function monthsBefore(day: string, months: number): string {
	const year = Number(day.slice(0, 4));
	const month = Number(day.slice(5, 7)) - 1 - months;
	const date = new Date(Date.UTC(year, month, 1));
	return date.toISOString().slice(0, 10);
}

/** The accounts the viewer holds and may still write to. */
async function heldAccounts(viewer: Viewer): Promise<string[]> {
	const access = await accountAccess(db, viewer);
	return [...access]
		.filter(([, rights]) => rights.isHolder && !rights.archived)
		.map(([accountId]) => accountId);
}

/** The history of the accounts the viewer holds, its transactions given their one tag. */
async function historyOf(
	householdId: string,
	held: string[],
	from: string,
	today: string,
): Promise<PastTransaction[]> {
	const where = and(
		eq(transactions.householdId, householdId),
		inArray(transactions.accountId, held),
		gte(transactions.date, from),
		lte(transactions.date, today),
	);
	const [rows, lines] = await Promise.all([
		db
			.select({
				id: transactions.id,
				type: transactions.type,
				accountId: transactions.accountId,
				toAccountId: transactions.toAccountId,
				payee: transactions.payee,
				amount: transactions.amount,
				date: transactions.date,
			})
			.from(transactions)
			.where(where),
		db
			.select({
				transactionId: transactionLines.transactionId,
				tagId: transactionLines.tagId,
			})
			.from(transactionLines)
			.innerJoin(
				transactions,
				eq(transactions.id, transactionLines.transactionId),
			)
			.where(where),
	]);
	// A transaction's tag when all its lines have the same; none otherwise
	const tags = new Map<string, Set<string | null>>();
	for (const line of lines) {
		const set = tags.get(line.transactionId) ?? new Set();
		set.add(line.tagId);
		tags.set(line.transactionId, set);
	}
	return rows.map((row) => {
		const set = tags.get(row.id);
		const [only] = set?.size === 1 ? [...set] : [null];
		return { ...row, tagId: only ?? null };
	});
}

/** The schedules that cover a series: the household's recurring transactions going on, and the series dismissed. */
async function coveredSchedules(
	householdId: string,
): Promise<CoveredSchedule[]> {
	const [recurring, dismissed] = await Promise.all([
		db
			.select({
				accountId: recurringTransactions.accountId,
				toAccountId: recurringTransactions.toAccountId,
				type: recurringTransactions.type,
				payee: recurringTransactions.payee,
				unit: recurringTransactions.unit,
				interval: recurringTransactions.interval,
				startDate: recurringTransactions.startDate,
				amount: recurringTransactions.amount,
			})
			.from(recurringTransactions)
			.where(
				and(
					eq(recurringTransactions.householdId, householdId),
					isNotNull(recurringTransactions.nextDate),
				),
			),
		db
			.select()
			.from(recurringDismissals)
			.where(eq(recurringDismissals.householdId, householdId)),
	]);
	return [
		...recurring.map(({ payee, ...schedule }) => ({
			...schedule,
			key: descriptionKey(payee ?? ""),
		})),
		...dismissed.map((dismissal) => ({
			accountId: dismissal.accountId,
			toAccountId: dismissal.toAccountId,
			type: dismissal.type,
			key: dismissal.key,
			unit: dismissal.unit,
			interval: dismissal.interval,
			startDate: dismissal.startDate,
			amount: null,
		})),
	];
}

/**
 * The series found in the history of the accounts the viewer holds, as
 * recurring transactions to create: those going on, neither covered by a
 * recurring transaction of the household nor dismissed; the next due first.
 */
export async function listSuggestions(
	viewer: Viewer,
	pagination: PaginationQuery,
): Promise<Paginated<RecurringSuggestion>> {
	const household = viewer.membership.household;
	const held = await heldAccounts(viewer);
	if (held.length === 0) {
		return { data: [], pagination: { ...pagination, total: 0 } };
	}
	const today = todayIn(household.timeZone);
	const [history, covered] = await Promise.all([
		historyOf(
			household.id,
			held,
			monthsBefore(today, SUGGESTION_HISTORY_MONTHS),
			today,
		),
		coveredSchedules(household.id),
	]);
	const patterns = findRecurringPatterns(history, { today, covered });
	const offset = offsetOf(pagination);
	return {
		data: patterns
			.slice(offset, offset + pagination.pageSize)
			.map((pattern) => ({
				accountId: pattern.accountId,
				toAccountId: pattern.toAccountId,
				type: pattern.type,
				key: pattern.key,
				payee: pattern.payee,
				unit: pattern.unit,
				interval: pattern.interval,
				amount: pattern.amount,
				minAmount: pattern.minAmount,
				maxAmount: pattern.maxAmount,
				mode: pattern.mode,
				nextDate: pattern.nextDate,
				tagId: pattern.tagId,
				count: pattern.dates.length,
				dates: pattern.dates.slice(-SUGGESTION_MAX_DATES),
			})),
		pagination: { ...pagination, total: patterns.length },
	};
}

/**
 * Says a series doesn't repeat: it is no longer suggested, to any member.
 * Only a holder of its account may, as only they are offered it.
 */
export async function dismissSuggestion(
	viewer: Viewer,
	suggestion: RecurringSuggestionKey,
): Promise<void> {
	const household = viewer.membership.household;
	const access = await accountAccess(db, viewer);
	const account = access.get(suggestion.accountId);
	if (!account?.isHolder) {
		throw new AppError(404, "not_found", "Account not found");
	}
	if (suggestion.toAccountId !== null && !access.has(suggestion.toAccountId)) {
		throw new AppError(404, "not_found", "Account not found");
	}
	await db.transaction(async (tx) => {
		await tx.insert(recurringDismissals).values({
			...suggestion,
			householdId: household.id,
			dismissedBy: viewer.userId,
		});
		await publishHouseholdEvent(tx, household.id, "recurring");
	});
}
