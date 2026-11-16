import type {
	CreateSettlement,
	Paginated,
	Settlement,
	SharedExpense,
	SharingBalance,
	SharingOverview,
	UpdateSharingWeights,
} from "@repo/schemas";
import {
	and,
	count,
	desc,
	eq,
	exists,
	type InferSelectModel,
	inArray,
	isNotNull,
	or,
} from "drizzle-orm";
import { db } from "@/db/client";
import {
	householdMembers,
	ledgerAccountHolders,
	settlements,
	sharingWeights,
	transactionShares,
	transactions,
	users,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { publishHouseholdEvent } from "@/lib/events";
import { offsetOf } from "@/lib/pagination";
import type { Viewer } from "@/routes/accounts/accounts.service";
import type { SharingPage } from "@/routes/sharing/sharing.schemas";
import { settleUp } from "@/routes/sharing/split";
import { assertSharingEnabled } from "@/routes/sharing/transaction-sharing";
import {
	accountAccess,
	deleteTransaction,
	recordTransaction,
} from "@/routes/transactions/transactions.service";

type SettlementRow = InferSelectModel<typeof settlements>;

function toSettlement(row: SettlementRow): Settlement {
	return {
		id: row.id,
		fromUserId: row.fromUserId,
		toUserId: row.toUserId,
		amount: row.amount,
		date: row.date,
		note: row.note,
		transactionId: row.transactionId,
		createdAt: row.createdAt.toISOString(),
	};
}

/** The household's members, in the order they joined. */
function membersOf(householdId: string) {
	return db
		.select({ userId: users.id, name: users.name, email: users.email })
		.from(householdMembers)
		.innerJoin(users, eq(users.id, householdMembers.userId))
		.where(eq(householdMembers.householdId, householdId))
		.orderBy(householdMembers.createdAt, users.id);
}

/**
 * Each one's balance: positive when the others owe them. A shared expense
 * makes the others owe the payer their parts; a shared refund, the other
 * way round. A settlement brings the one who paid closer to zero.
 */
async function balancesOf(householdId: string): Promise<Map<string, number>> {
	const [parts, paid] = await Promise.all([
		db
			.select({
				userId: transactionShares.userId,
				amount: transactionShares.amount,
				type: transactions.type,
				paidBy: transactions.sharePaidBy,
			})
			.from(transactionShares)
			.innerJoin(
				transactions,
				eq(transactions.id, transactionShares.transactionId),
			)
			.where(
				and(
					eq(transactionShares.householdId, householdId),
					isNotNull(transactions.sharePaidBy),
				),
			),
		db
			.select({
				fromUserId: settlements.fromUserId,
				toUserId: settlements.toUserId,
				amount: settlements.amount,
			})
			.from(settlements)
			.where(eq(settlements.householdId, householdId)),
	]);
	const balances = new Map<string, number>();
	const add = (userId: string, amount: number) =>
		balances.set(userId, (balances.get(userId) ?? 0) + amount);
	for (const { userId, amount, type, paidBy } of parts) {
		if (paidBy === null || userId === paidBy) {
			continue;
		}
		const signed = type === "income" ? -amount : amount;
		add(paidBy, signed);
		add(userId, -signed);
	}
	for (const { fromUserId, toUserId, amount } of paid) {
		add(fromUserId, amount);
		add(toUserId, -amount);
	}
	return balances;
}

/** Where the members stand, the default split, and how to settle. */
export async function sharingOverview(
	viewer: Viewer,
): Promise<SharingOverview> {
	assertSharingEnabled(viewer);
	const householdId = viewer.membership.household.id;
	const [members, weights, balances] = await Promise.all([
		membersOf(householdId),
		db
			.select()
			.from(sharingWeights)
			.where(eq(sharingWeights.householdId, householdId)),
		balancesOf(householdId),
	]);
	const memberIds = new Set(members.map((member) => member.userId));
	// Someone who left with a balance still shows
	const formerIds = [...balances]
		.filter(([userId, balance]) => balance !== 0 && !memberIds.has(userId))
		.map(([userId]) => userId);
	const former =
		formerIds.length === 0
			? []
			: await db
					.select({ userId: users.id, name: users.name, email: users.email })
					.from(users)
					.where(inArray(users.id, formerIds));
	const people: SharingBalance[] = [
		...members.map((person) => ({ ...person, isMember: true })),
		...former.map((person) => ({ ...person, isMember: false })),
	]
		.map(({ userId, name, email, isMember }) => ({
			userId,
			name: name || email,
			isMember,
			balance: balances.get(userId) ?? 0,
		}))
		.sort((a, b) => b.balance - a.balance);
	const weightOf = new Map(weights.map((each) => [each.userId, each.weight]));
	return {
		weights: members.map(({ userId }) => ({
			userId,
			weight: weightOf.get(userId) ?? 1,
		})),
		balances: people,
		suggestions: settleUp(people),
	};
}

/** Sets the household's default split; for its owners. */
export async function setSharingWeights(
	viewer: Viewer,
	{ weights }: UpdateSharingWeights,
): Promise<SharingOverview> {
	assertSharingEnabled(viewer);
	if (viewer.membership.role !== "owner") {
		throw new AppError(
			403,
			"forbidden",
			"Only an owner can change the default split",
		);
	}
	const householdId = viewer.membership.household.id;
	const memberIds = new Set(
		(await membersOf(householdId)).map((member) => member.userId),
	);
	const invalid = weights.flatMap(({ userId }, index) =>
		memberIds.has(userId)
			? []
			: [{ field: `weights.${index}.userId`, message: "share_member_invalid" }],
	);
	if (invalid.length > 0) {
		throw new AppError(422, "validation_error", "Invalid request", invalid);
	}
	if (weights.every((each) => each.weight === 0)) {
		throw new AppError(422, "validation_error", "Invalid request", [
			{ field: "weights", message: "share_weight_invalid" },
		]);
	}
	await db.transaction(async (tx) => {
		for (const { userId, weight } of weights) {
			await tx
				.insert(sharingWeights)
				.values({ householdId, userId, weight })
				.onConflictDoUpdate({
					target: [sharingWeights.householdId, sharingWeights.userId],
					set: { weight },
				});
		}
		await publishHouseholdEvent(tx, householdId, "sharing");
	});
	return sharingOverview(viewer);
}

/**
 * The household's shared transactions the viewer is concerned by, the most
 * recent first: the ones they paid, the ones they have a part in, and the
 * ones of the accounts whose details they see.
 */
export async function listSharedExpenses(
	viewer: Viewer,
	pagination: SharingPage,
): Promise<Paginated<SharedExpense>> {
	assertSharingEnabled(viewer);
	const householdId = viewer.membership.household.id;
	const access = await accountAccess(db, viewer);
	const detailed = [...access]
		.filter(([, account]) => account.seesDetails)
		.map(([id]) => id);
	const where = and(
		eq(transactions.householdId, householdId),
		isNotNull(transactions.sharePaidBy),
		or(
			eq(transactions.sharePaidBy, viewer.userId),
			exists(
				db
					.select({ id: transactionShares.id })
					.from(transactionShares)
					.where(
						and(
							eq(transactionShares.transactionId, transactions.id),
							eq(transactionShares.userId, viewer.userId),
						),
					),
			),
			detailed.length > 0
				? inArray(transactions.accountId, detailed)
				: undefined,
		),
	);
	const [rows, [counted]] = await Promise.all([
		db
			.select()
			.from(transactions)
			.where(where)
			.orderBy(desc(transactions.date), desc(transactions.createdAt))
			.limit(pagination.pageSize)
			.offset(offsetOf(pagination)),
		db.select({ total: count() }).from(transactions).where(where),
	]);
	const parts =
		rows.length === 0
			? []
			: await db
					.select()
					.from(transactionShares)
					.where(
						inArray(
							transactionShares.transactionId,
							rows.map((row) => row.id),
						),
					);
	return {
		data: rows.flatMap((row) =>
			row.type === "transfer" || row.sharePaidBy === null
				? []
				: [
						{
							transactionId: row.id,
							type: row.type,
							date: row.date,
							payee: row.payee,
							amount: row.amount,
							paidBy: row.sharePaidBy,
							parts: parts
								.filter((part) => part.transactionId === row.id)
								.map(({ userId, amount }) => ({ userId, amount })),
						},
					],
		),
		pagination: { ...pagination, total: counted?.total ?? 0 },
	};
}

/** The household's settlements, the most recent first. */
export async function listSettlements(
	viewer: Viewer,
	pagination: SharingPage,
): Promise<Paginated<Settlement>> {
	assertSharingEnabled(viewer);
	const where = eq(settlements.householdId, viewer.membership.household.id);
	const [rows, [counted]] = await Promise.all([
		db
			.select()
			.from(settlements)
			.where(where)
			.orderBy(desc(settlements.date), desc(settlements.createdAt))
			.limit(pagination.pageSize)
			.offset(offsetOf(pagination)),
		db.select({ total: count() }).from(settlements).where(where),
	]);
	return {
		data: rows.map(toSettlement),
		pagination: { ...pagination, total: counted?.total ?? 0 },
	};
}

function invalid(field: string, message: string): AppError {
	return new AppError(422, "validation_error", "Invalid request", [
		{ field, message },
	]);
}

/**
 * Records that a member paid another, by the one who paid or the one paid.
 * With `transfer`, the payment is also recorded as a transfer from an
 * account the payer holds to one the other holds: by a holder of the
 * first, as any transfer.
 */
export async function createSettlement(
	viewer: Viewer,
	input: CreateSettlement,
): Promise<Settlement> {
	assertSharingEnabled(viewer);
	const householdId = viewer.membership.household.id;
	const memberIds = new Set(
		(await membersOf(householdId)).map((member) => member.userId),
	);
	for (const field of ["fromUserId", "toUserId"] as const) {
		if (!memberIds.has(input[field])) {
			throw invalid(field, "share_member_invalid");
		}
	}
	if (viewer.userId !== input.fromUserId && viewer.userId !== input.toUserId) {
		throw new AppError(
			403,
			"forbidden",
			"Only the one who paid, or the one paid, records a settlement",
		);
	}
	return db.transaction(async (tx) => {
		let transactionId: string | null = null;
		if (input.transfer) {
			const { fromAccountId, toAccountId } = input.transfer;
			const holders = await tx
				.select({
					accountId: ledgerAccountHolders.accountId,
					userId: ledgerAccountHolders.userId,
				})
				.from(ledgerAccountHolders)
				.where(
					and(
						eq(ledgerAccountHolders.householdId, householdId),
						inArray(ledgerAccountHolders.accountId, [
							fromAccountId,
							toAccountId,
						]),
					),
				);
			const holds = (accountId: string, userId: string) =>
				holders.some(
					(each) => each.accountId === accountId && each.userId === userId,
				);
			if (!holds(fromAccountId, input.fromUserId)) {
				throw invalid("transfer.fromAccountId", "settlement_account_invalid");
			}
			if (!holds(toAccountId, input.toUserId)) {
				throw invalid("transfer.toAccountId", "settlement_account_invalid");
			}
			const transfer = await recordTransaction(
				tx,
				viewer,
				{
					type: "transfer",
					accountId: fromAccountId,
					toAccountId,
					date: input.date,
					amount: input.amount,
					note: input.note || null,
				},
				{ origin: "manual" },
			);
			transactionId = transfer.id;
			await publishHouseholdEvent(tx, householdId, "transactions");
		}
		const [row] = await tx
			.insert(settlements)
			.values({
				householdId,
				fromUserId: input.fromUserId,
				toUserId: input.toUserId,
				amount: input.amount,
				date: input.date,
				note: input.note || null,
				transactionId,
				createdBy: viewer.userId,
			})
			.returning();
		if (!row) {
			throw new Error("The settlement was not recorded");
		}
		await publishHouseholdEvent(tx, householdId, "sharing");
		return toSettlement(row);
	});
}

/**
 * Deletes a settlement, by the one who paid or the one paid; with the
 * transfer recorded with it, which only its account's holders can delete.
 */
export async function deleteSettlement(
	viewer: Viewer,
	settlementId: string,
): Promise<void> {
	assertSharingEnabled(viewer);
	const householdId = viewer.membership.household.id;
	const [row] = await db
		.select()
		.from(settlements)
		.where(
			and(
				eq(settlements.id, settlementId),
				eq(settlements.householdId, householdId),
			),
		);
	if (!row) {
		throw new AppError(404, "not_found", "Settlement not found");
	}
	if (viewer.userId !== row.fromUserId && viewer.userId !== row.toUserId) {
		throw new AppError(
			403,
			"forbidden",
			"Only the one who paid, or the one paid, deletes a settlement",
		);
	}
	if (row.transactionId) {
		// The settlement goes with its transfer
		await deleteTransaction(viewer, row.transactionId);
	} else {
		await db.delete(settlements).where(eq(settlements.id, row.id));
	}
	await publishHouseholdEvent(db, householdId, "sharing");
}
