import type {
	CreateTransaction,
	Paginated,
	Transaction,
	TransactionLineInput,
	UpdateTransaction,
} from "@repo/schemas";
import {
	and,
	asc,
	count,
	desc,
	eq,
	exists,
	gte,
	type InferSelectModel,
	inArray,
	lte,
	or,
	type SQL,
} from "drizzle-orm";
import { db, type Transaction as Tx } from "@/db/client";
import {
	ledgerAccountHolders,
	ledgerAccounts,
	tags,
	transactionLines,
	transactions,
	users,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { publishHouseholdEvent } from "@/lib/events";
import { offsetOf } from "@/lib/pagination";
import type { Viewer } from "@/routes/accounts/accounts.service";
import type { TransactionsQuery } from "@/routes/transactions/transactions.schemas";

type TransactionRow = InferSelectModel<typeof transactions>;
type LineRow = InferSelectModel<typeof transactionLines>;
export type Database = typeof db | Tx;

function notFound(): AppError {
	return new AppError(404, "not_found", "Transaction not found");
}

function invalid(field: string, message: string): AppError {
	return new AppError(422, "validation_error", "Invalid request", [
		{ field, message },
	]);
}

/** What the viewer may do with an account of their household. */
export interface AccountAccess {
	/** Holders write the account's transactions. */
	isHolder: boolean;
	/** Holders, and everyone when the account shows its details. */
	seesDetails: boolean;
	archived: boolean;
}

/** The viewer's access to each account of the household. */
export async function accountAccess(
	database: Database,
	{ userId, membership }: Viewer,
): Promise<Map<string, AccountAccess>> {
	const householdId = membership.household.id;
	const [accounts, held] = await Promise.all([
		database
			.select({
				id: ledgerAccounts.id,
				visibility: ledgerAccounts.visibility,
				archivedAt: ledgerAccounts.archivedAt,
			})
			.from(ledgerAccounts)
			.where(eq(ledgerAccounts.householdId, householdId)),
		database
			.select({ accountId: ledgerAccountHolders.accountId })
			.from(ledgerAccountHolders)
			.where(
				and(
					eq(ledgerAccountHolders.householdId, householdId),
					eq(ledgerAccountHolders.userId, userId),
				),
			),
	]);
	const heldIds = new Set(held.map((row) => row.accountId));
	return new Map(
		accounts.map((account) => {
			const isHolder = heldIds.has(account.id);
			return [
				account.id,
				{
					isHolder,
					seesDetails: isHolder || account.visibility === "details",
					archived: account.archivedAt !== null,
				},
			];
		}),
	);
}

/**
 * A transaction shows to those who see the details of its account. A
 * transfer belongs to two accounts: seeing the details of either is enough.
 */
export function isVisible(
	row: Pick<TransactionRow, "accountId" | "toAccountId">,
	access: Map<string, AccountAccess>,
): boolean {
	return [row.accountId, row.toAccountId].some(
		(accountId) => accountId !== null && access.get(accountId)?.seesDetails,
	);
}

function toTransaction(
	row: TransactionRow,
	lines: LineRow[],
	creator: { name: string; email: string } | null,
): Transaction {
	return {
		id: row.id,
		householdId: row.householdId,
		type: row.type,
		date: row.date,
		accountId: row.accountId,
		toAccountId: row.toAccountId,
		amount: row.amount,
		payee: row.payee,
		note: row.note,
		origin: row.origin,
		receipt: row.receipt,
		lines: lines.map((line) => ({
			id: line.id,
			amount: line.amount,
			tagId: line.tagId,
		})),
		createdBy:
			row.createdBy && creator
				? { userId: row.createdBy, name: creator.name || creator.email }
				: null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

/** The transactions with their lines, in entry order, and who recorded them. */
async function withDetails(
	database: Database,
	rows: TransactionRow[],
): Promise<Transaction[]> {
	if (rows.length === 0) {
		return [];
	}
	const creatorIds = [
		...new Set(rows.flatMap((row) => (row.createdBy ? [row.createdBy] : []))),
	];
	const [lines, creators] = await Promise.all([
		database
			.select()
			.from(transactionLines)
			.where(
				inArray(
					transactionLines.transactionId,
					rows.map((row) => row.id),
				),
			)
			.orderBy(asc(transactionLines.position)),
		creatorIds.length === 0
			? []
			: database
					.select({ id: users.id, name: users.name, email: users.email })
					.from(users)
					.where(inArray(users.id, creatorIds)),
	]);
	const creatorById = new Map(creators.map((creator) => [creator.id, creator]));
	return rows.map((row) =>
		toTransaction(
			row,
			lines.filter((line) => line.transactionId === row.id),
			(row.createdBy && creatorById.get(row.createdBy)) || null,
		),
	);
}

/** The identifiers of a tag and of every tag under it, in the household. */
async function tagSubtree(
	householdId: string,
	tagId: string,
): Promise<string[]> {
	const rows = await db
		.select({ id: tags.id, parentId: tags.parentId })
		.from(tags)
		.where(eq(tags.householdId, householdId));
	const ids = new Set([tagId]);
	// Tags are few: repeat until no more child is found
	let grew = true;
	while (grew) {
		grew = false;
		for (const row of rows) {
			if (row.parentId !== null && ids.has(row.parentId) && !ids.has(row.id)) {
				ids.add(row.id);
				grew = true;
			}
		}
	}
	return [...ids];
}

/**
 * The transactions of the household the viewer may see, most recent first:
 * those of the accounts they hold or that show their details.
 */
export async function listTransactions(
	viewer: Viewer,
	{ accountId, tagId, type, from, to, ...pagination }: TransactionsQuery,
): Promise<Paginated<Transaction>> {
	const householdId = viewer.membership.household.id;
	const access = await accountAccess(db, viewer);
	const visibleIds = [...access]
		.filter(([, account]) => account.seesDetails)
		.map(([id]) => id);
	const empty = { data: [], pagination: { ...pagination, total: 0 } };
	if (visibleIds.length === 0) {
		return empty;
	}

	const filters: (SQL | undefined)[] = [
		eq(transactions.householdId, householdId),
		or(
			inArray(transactions.accountId, visibleIds),
			inArray(transactions.toAccountId, visibleIds),
		),
		type && eq(transactions.type, type),
		from ? gte(transactions.date, from) : undefined,
		to ? lte(transactions.date, to) : undefined,
	];
	if (accountId) {
		// An account the viewer can't see the details of shows nothing
		if (!access.get(accountId)?.seesDetails) {
			return empty;
		}
		filters.push(
			or(
				eq(transactions.accountId, accountId),
				eq(transactions.toAccountId, accountId),
			),
		);
	}
	if (tagId) {
		filters.push(
			exists(
				db
					.select({ id: transactionLines.id })
					.from(transactionLines)
					.where(
						and(
							eq(transactionLines.transactionId, transactions.id),
							inArray(
								transactionLines.tagId,
								await tagSubtree(householdId, tagId),
							),
						),
					),
			),
		);
	}

	const where = and(...filters);
	const [rows, [counted]] = await Promise.all([
		db
			.select()
			.from(transactions)
			.where(where)
			// The most recent day first; within a day, the last recorded first
			.orderBy(
				desc(transactions.date),
				desc(transactions.createdAt),
				desc(transactions.id),
			)
			.limit(pagination.pageSize)
			.offset(offsetOf(pagination)),
		db.select({ total: count() }).from(transactions).where(where),
	]);
	return {
		data: await withDetails(db, rows),
		pagination: { ...pagination, total: counted?.total ?? 0 },
	};
}

export async function getTransaction(
	viewer: Viewer,
	transactionId: string,
): Promise<Transaction> {
	const [[row], access] = await Promise.all([
		db
			.select()
			.from(transactions)
			.where(
				and(
					eq(transactions.id, transactionId),
					eq(transactions.householdId, viewer.membership.household.id),
				),
			),
		accountAccess(db, viewer),
	]);
	// Hidden from the viewer: as if it didn't exist
	if (!row || !isVisible(row, access)) {
		throw notFound();
	}
	const [transaction] = await withDetails(db, [row]);
	if (!transaction) {
		throw notFound();
	}
	return transaction;
}

/**
 * Checks an account can take the transaction: it is in the household, the
 * viewer holds it when it is the one they write to, and it isn't archived.
 */
export function assertAccount(
	access: Map<string, AccountAccess>,
	accountId: string,
	field: "accountId" | "toAccountId",
): void {
	const account = access.get(accountId);
	if (!account) {
		throw invalid(field, "transaction_account_invalid");
	}
	// The viewer writes to the account the money leaves, or enters for an
	// income; a transfer's destination can be anyone's
	if (field === "accountId" && !account.isHolder) {
		throw new AppError(
			403,
			"forbidden",
			"Only a holder of the account can record its transactions",
		);
	}
	if (account.archived) {
		throw new AppError(
			409,
			"account_archived",
			"An archived account takes no new transaction",
		);
	}
}

/** Every tag of the lines must be a tag of the household. */
async function assertTags(
	tx: Tx,
	householdId: string,
	lines: TransactionLineInput[],
): Promise<void> {
	const tagIds = [
		...new Set(lines.flatMap((line) => (line.tagId ? [line.tagId] : []))),
	];
	if (tagIds.length === 0) {
		return;
	}
	const known = await tx
		.select({ id: tags.id })
		.from(tags)
		.where(and(eq(tags.householdId, householdId), inArray(tags.id, tagIds)));
	const knownIds = new Set(known.map((tag) => tag.id));
	const unknown = lines.flatMap((line, index) =>
		line.tagId && !knownIds.has(line.tagId)
			? [{ field: `lines.${index}.tagId`, message: "transaction_tag_invalid" }]
			: [],
	);
	if (unknown.length > 0) {
		throw new AppError(422, "validation_error", "Invalid request", unknown);
	}
}

/** The columns of a transaction from what the client sent, once checked. */
export async function toValues(
	tx: Tx,
	viewer: Viewer,
	access: Map<string, AccountAccess>,
	input: UpdateTransaction,
) {
	assertAccount(access, input.accountId, "accountId");
	const common = {
		type: input.type,
		date: input.date,
		accountId: input.accountId,
		note: input.note || null,
	};
	if (input.type === "transfer") {
		assertAccount(access, input.toAccountId, "toAccountId");
		return {
			...common,
			toAccountId: input.toAccountId,
			amount: input.amount,
			payee: null,
			lines: [],
		};
	}
	await assertTags(tx, viewer.membership.household.id, input.lines);
	return {
		...common,
		toAccountId: null,
		// The amount is never sent: it can't contradict the lines
		amount: input.lines.reduce((total, line) => total + line.amount, 0),
		payee: input.payee || null,
		lines: input.lines,
	};
}

async function insertLines(
	tx: Tx,
	householdId: string,
	transactionId: string,
	lines: TransactionLineInput[],
): Promise<void> {
	if (lines.length === 0) {
		return;
	}
	await tx.insert(transactionLines).values(
		lines.map((line, position) => ({
			transactionId,
			householdId,
			position,
			amount: line.amount,
			tagId: line.tagId ?? null,
		})),
	);
}

/** Records a transaction on an account the viewer holds. */
export async function createTransaction(
	viewer: Viewer,
	{ origin = "manual", externalId, ...fields }: CreateTransaction,
): Promise<Transaction> {
	const { receipt, ...input } =
		"receipt" in fields ? fields : { ...fields, receipt: undefined };
	const householdId = viewer.membership.household.id;
	return db.transaction(async (tx) => {
		const access = await accountAccess(tx, viewer);
		const { lines, ...values } = await toValues(tx, viewer, access, input);
		if (externalId !== undefined) {
			// The same statement line is never imported twice into an account
			const [imported] = await tx
				.select({ id: transactions.id })
				.from(transactions)
				.where(
					and(
						eq(transactions.accountId, values.accountId),
						eq(transactions.externalId, externalId),
					),
				);
			if (imported) {
				throw new AppError(
					409,
					"transaction_already_imported",
					"This transaction was already imported into the account",
				);
			}
		}
		const [row] = await tx
			.insert(transactions)
			.values({
				...values,
				householdId,
				origin,
				externalId: externalId ?? null,
				receipt: receipt ?? null,
				createdBy: viewer.userId,
			})
			.returning();
		if (!row) {
			throw new Error("The transaction was not created");
		}
		await insertLines(tx, householdId, row.id, lines);
		await publishHouseholdEvent(tx, householdId, "transactions");
		const [transaction] = await withDetails(tx, [row]);
		if (!transaction) {
			throw new Error("The transaction was not created");
		}
		return transaction;
	});
}

/**
 * Locks a transaction the viewer may change: they see it, they hold the
 * account it was recorded on, and that account isn't archived.
 */
async function lockForChange(
	tx: Tx,
	viewer: Viewer,
	access: Map<string, AccountAccess>,
	transactionId: string,
): Promise<TransactionRow> {
	const [row] = await tx
		.select()
		.from(transactions)
		.where(
			and(
				eq(transactions.id, transactionId),
				eq(transactions.householdId, viewer.membership.household.id),
			),
		)
		.for("update");
	if (!row || !isVisible(row, access)) {
		throw notFound();
	}
	assertAccount(access, row.accountId, "accountId");
	return row;
}

/** Replaces a transaction with the one sent; where it comes from is kept. */
export async function updateTransaction(
	viewer: Viewer,
	transactionId: string,
	input: UpdateTransaction,
): Promise<Transaction> {
	const householdId = viewer.membership.household.id;
	return db.transaction(async (tx) => {
		const access = await accountAccess(tx, viewer);
		await lockForChange(tx, viewer, access, transactionId);
		const { lines, ...values } = await toValues(tx, viewer, access, input);
		const [row] = await tx
			.update(transactions)
			.set(values)
			.where(eq(transactions.id, transactionId))
			.returning();
		if (!row) {
			throw notFound();
		}
		await tx
			.delete(transactionLines)
			.where(eq(transactionLines.transactionId, transactionId));
		await insertLines(tx, householdId, transactionId, lines);
		await publishHouseholdEvent(tx, householdId, "transactions");
		const [transaction] = await withDetails(tx, [row]);
		if (!transaction) {
			throw notFound();
		}
		return transaction;
	});
}

export async function deleteTransaction(
	viewer: Viewer,
	transactionId: string,
): Promise<void> {
	await db.transaction(async (tx) => {
		const access = await accountAccess(tx, viewer);
		await lockForChange(tx, viewer, access, transactionId);
		await tx.delete(transactions).where(eq(transactions.id, transactionId));
		await publishHouseholdEvent(
			tx,
			viewer.membership.household.id,
			"transactions",
		);
	});
}
