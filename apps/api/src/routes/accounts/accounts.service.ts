import type {
	Account,
	AccountHolder,
	AccountsSummary,
	CreateAccount,
	Paginated,
	UpdateAccount,
} from "@repo/schemas";
import {
	and,
	asc,
	count,
	eq,
	type InferSelectModel,
	inArray,
	isNotNull,
	notInArray,
	or,
	sql,
	sum,
} from "drizzle-orm";
import { db, type Transaction } from "@/db/client";
import {
	householdMembers,
	ledgerAccountHolders,
	ledgerAccounts,
	transactions,
	users,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { publishHouseholdEvent } from "@/lib/events";
import { offsetOf, type PaginationQuery } from "@/lib/pagination";
import type { Membership } from "@/routes/households/households.service";

type AccountRow = InferSelectModel<typeof ledgerAccounts>;

/** The member looking at, or changing, the accounts of their household. */
export interface Viewer {
	userId: string;
	membership: Membership;
}

function notFound(): AppError {
	return new AppError(404, "not_found", "Account not found");
}

function invalidHolders(): AppError {
	return new AppError(422, "validation_error", "Invalid request", [
		{ field: "holderIds", message: "account_holders_invalid" },
	]);
}

/**
 * The account as `userId` may see it. Holders see everything; the other
 * members see the balance, and the rest only when the account shows its details.
 */
function toAccount(
	row: AccountRow,
	holders: AccountHolder[],
	userId: string,
	/** What the account's transactions add to, or take from, its opening balance. */
	movement: number,
): Account {
	const isHolder = holders.some((holder) => holder.userId === userId);
	const seesDetails = isHolder || row.visibility === "details";
	return {
		id: row.id,
		householdId: row.householdId,
		name: row.name,
		type: row.type,
		visibility: row.visibility,
		balance: row.openingBalance + movement,
		openingBalance: seesDetails ? row.openingBalance : null,
		holders,
		isHolder,
		archived: row.archivedAt !== null,
		createdAt: row.createdAt.toISOString(),
	};
}

/**
 * What the transactions of the household add to, or take from, the opening
 * balance of each account: incomes and transfers received, minus expenses
 * and transfers sent. An account without transactions is absent.
 */
export async function movementsOf(
	householdId: string,
	database: typeof db | Transaction = db,
): Promise<Map<string, number>> {
	const ofHousehold = eq(transactions.householdId, householdId);
	// Sums of bigint come back as numeric strings, hence mapWith(Number)
	const [own, received] = await Promise.all([
		database
			.select({
				accountId: transactions.accountId,
				// Raw SQL: a signed sum has no Drizzle helper. Only an income
				// adds to its account.
				total:
					sql`sum(case when ${transactions.type} = 'income' then ${transactions.amount} else -${transactions.amount} end)`.mapWith(
						Number,
					),
			})
			.from(transactions)
			.where(ofHousehold)
			.groupBy(transactions.accountId),
		database
			.select({
				accountId: transactions.toAccountId,
				total: sum(transactions.amount).mapWith(Number),
			})
			.from(transactions)
			.where(and(ofHousehold, isNotNull(transactions.toAccountId)))
			.groupBy(transactions.toAccountId),
	]);
	const movements = new Map<string, number>();
	for (const { accountId, total } of [...own, ...received]) {
		if (accountId !== null) {
			movements.set(accountId, (movements.get(accountId) ?? 0) + total);
		}
	}
	return movements;
}

/** The holders of each of the accounts, sorted by name. */
async function holdersOf(
	accountIds: string[],
	database: typeof db | Transaction = db,
): Promise<Map<string, AccountHolder[]>> {
	const byAccount = new Map<string, AccountHolder[]>();
	if (accountIds.length === 0) {
		return byAccount;
	}
	const rows = await database
		.select({
			accountId: ledgerAccountHolders.accountId,
			userId: users.id,
			name: users.name,
			email: users.email,
		})
		.from(ledgerAccountHolders)
		.innerJoin(users, eq(users.id, ledgerAccountHolders.userId))
		.where(inArray(ledgerAccountHolders.accountId, accountIds));
	for (const row of rows) {
		const holders = byAccount.get(row.accountId) ?? [];
		holders.push({ userId: row.userId, name: row.name || row.email });
		byAccount.set(row.accountId, holders);
	}
	// Holders added together share a timestamp: sort by name for a stable
	// order, with the id to tell namesakes apart
	for (const holders of byAccount.values()) {
		holders.sort(
			(a, b) =>
				compare(a.name.toLowerCase(), b.name.toLowerCase()) ||
				compare(a.userId, b.userId),
		);
	}
	return byAccount;
}

function compare(a: string, b: string): number {
	if (a === b) {
		return 0;
	}
	return a < b ? -1 : 1;
}

const inHousehold = (householdId: string, accountId: string) =>
	and(
		eq(ledgerAccounts.id, accountId),
		eq(ledgerAccounts.householdId, householdId),
	);

/** Every holder must be a member of the household. */
async function assertMembers(
	tx: Transaction,
	householdId: string,
	userIds: string[],
): Promise<void> {
	const members = await tx
		.select({ userId: householdMembers.userId })
		.from(householdMembers)
		.where(
			and(
				eq(householdMembers.householdId, householdId),
				inArray(householdMembers.userId, userIds),
			),
		);
	if (members.length !== userIds.length) {
		throw invalidHolders();
	}
}

/** The accounts of the household, oldest first, as the viewer may see them. */
export async function listAccounts(
	{ userId, membership }: Viewer,
	pagination: PaginationQuery,
): Promise<Paginated<Account>> {
	const ofHousehold = eq(ledgerAccounts.householdId, membership.household.id);
	const [rows, [counted]] = await Promise.all([
		db
			.select()
			.from(ledgerAccounts)
			.where(ofHousehold)
			.orderBy(asc(ledgerAccounts.createdAt), asc(ledgerAccounts.id))
			.limit(pagination.pageSize)
			.offset(offsetOf(pagination)),
		db.select({ total: count() }).from(ledgerAccounts).where(ofHousehold),
	]);
	const [holders, movements] = await Promise.all([
		holdersOf(rows.map((row) => row.id)),
		movementsOf(membership.household.id),
	]);
	return {
		data: rows.map((row) =>
			toAccount(
				row,
				holders.get(row.id) ?? [],
				userId,
				movements.get(row.id) ?? 0,
			),
		),
		pagination: { ...pagination, total: counted?.total ?? 0 },
	};
}

export async function getAccount(
	{ userId, membership }: Viewer,
	accountId: string,
): Promise<Account> {
	const [row] = await db
		.select()
		.from(ledgerAccounts)
		.where(inHousehold(membership.household.id, accountId));
	if (!row) {
		throw notFound();
	}
	const [holders, movements] = await Promise.all([
		holdersOf([row.id]),
		movementsOf(membership.household.id),
	]);
	return toAccount(
		row,
		holders.get(row.id) ?? [],
		userId,
		movements.get(row.id) ?? 0,
	);
}

/**
 * Creates an account held by the viewer, alone or with other members of the
 * household: whoever creates an account holds it.
 */
export async function createAccount(
	{ userId, membership }: Viewer,
	{ holderIds = [userId], ...fields }: CreateAccount,
): Promise<Account> {
	if (!holderIds.includes(userId)) {
		throw invalidHolders();
	}
	const householdId = membership.household.id;
	return db.transaction(async (tx) => {
		await assertMembers(tx, householdId, holderIds);
		const [row] = await tx
			.insert(ledgerAccounts)
			.values({ ...fields, householdId })
			.returning();
		if (!row) {
			throw new Error("The account was not created");
		}
		await tx.insert(ledgerAccountHolders).values(
			holderIds.map((holderId) => ({
				accountId: row.id,
				householdId,
				userId: holderId,
			})),
		);
		await publishHouseholdEvent(tx, householdId, "accounts");
		const holders = await holdersOf([row.id], tx);
		// A new account has no transactions yet
		return toAccount(row, holders.get(row.id) ?? [], userId, 0);
	});
}

/**
 * Locks the account and checks the viewer may change it: its holders, or an
 * owner of the household while the account has no holder left.
 */
async function lockForChange(
	tx: Transaction,
	{ userId, membership }: Viewer,
	accountId: string,
): Promise<AccountRow> {
	const [row] = await tx
		.select()
		.from(ledgerAccounts)
		.where(inHousehold(membership.household.id, accountId))
		.for("update");
	if (!row) {
		throw notFound();
	}
	const holders = await tx
		.select({ userId: ledgerAccountHolders.userId })
		.from(ledgerAccountHolders)
		.where(eq(ledgerAccountHolders.accountId, accountId));
	const isHolder = holders.some((holder) => holder.userId === userId);
	const adoptsOrphan = holders.length === 0 && membership.role === "owner";
	if (!isHolder && !adoptsOrphan) {
		throw new AppError(
			403,
			"forbidden",
			"Only a holder of the account can do this",
		);
	}
	return row;
}

export async function updateAccount(
	viewer: Viewer,
	accountId: string,
	{ holderIds, archived, ...fields }: UpdateAccount,
): Promise<Account> {
	const householdId = viewer.membership.household.id;
	return db.transaction(async (tx) => {
		let row = await lockForChange(tx, viewer, accountId);
		const changes = {
			...fields,
			// Keeps the date of an account that is already archived
			...(archived === undefined || archived === (row.archivedAt !== null)
				? {}
				: { archivedAt: archived ? new Date() : null }),
		};
		// Nothing to change: Drizzle rejects an empty update
		if (Object.values(changes).some((value) => value !== undefined)) {
			const [updated] = await tx
				.update(ledgerAccounts)
				.set(changes)
				.where(eq(ledgerAccounts.id, accountId))
				.returning();
			row = updated ?? row;
		}
		if (holderIds) {
			await assertMembers(tx, householdId, holderIds);
			await tx
				.delete(ledgerAccountHolders)
				.where(
					and(
						eq(ledgerAccountHolders.accountId, accountId),
						notInArray(ledgerAccountHolders.userId, holderIds),
					),
				);
			await tx
				.insert(ledgerAccountHolders)
				.values(
					holderIds.map((holderId) => ({
						accountId,
						householdId,
						userId: holderId,
					})),
				)
				.onConflictDoNothing();
		}
		await publishHouseholdEvent(tx, householdId, "accounts");
		const [holders, movements] = await Promise.all([
			holdersOf([accountId], tx),
			movementsOf(householdId, tx),
		]);
		return toAccount(
			row,
			holders.get(accountId) ?? [],
			viewer.userId,
			movements.get(accountId) ?? 0,
		);
	});
}

export async function deleteAccount(
	viewer: Viewer,
	accountId: string,
): Promise<void> {
	await db.transaction(async (tx) => {
		await lockForChange(tx, viewer, accountId);
		// Its transactions are the household's history: the account is
		// archived instead
		const [used] = await tx
			.select({ id: transactions.id })
			.from(transactions)
			.where(
				or(
					eq(transactions.accountId, accountId),
					eq(transactions.toAccountId, accountId),
				),
			)
			.limit(1);
		if (used) {
			throw new AppError(
				409,
				"account_has_transactions",
				"An account that has transactions can't be deleted, only archived",
			);
		}
		await tx.delete(ledgerAccounts).where(eq(ledgerAccounts.id, accountId));
		await publishHouseholdEvent(tx, viewer.membership.household.id, "accounts");
	});
}

/**
 * The consolidated view of the household: every account counts, whoever
 * holds it, whatever its visibility, archived or not. Transfers cancel out:
 * what leaves an account enters another.
 */
export async function summarizeAccounts(
	householdId: string,
): Promise<AccountsSummary> {
	const [rows, movements] = await Promise.all([
		db
			.select({
				id: ledgerAccounts.id,
				openingBalance: ledgerAccounts.openingBalance,
			})
			.from(ledgerAccounts)
			.where(eq(ledgerAccounts.householdId, householdId)),
		movementsOf(householdId),
	]);
	let assets = 0;
	let liabilities = 0;
	for (const row of rows) {
		const balance = row.openingBalance + (movements.get(row.id) ?? 0);
		if (balance > 0) {
			assets += balance;
		} else {
			liabilities += balance;
		}
	}
	return { assets, liabilities, balance: assets + liabilities };
}

/** Whether the household has at least one account. */
export async function hasAccounts(householdId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: ledgerAccounts.id })
		.from(ledgerAccounts)
		.where(eq(ledgerAccounts.householdId, householdId))
		.limit(1);
	return row !== undefined;
}
