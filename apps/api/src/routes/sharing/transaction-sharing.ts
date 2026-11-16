import type { ShareSplit, TransactionSharing } from "@repo/schemas";
import { eq, inArray } from "drizzle-orm";
import type { Transaction as Tx } from "@/db/client";
import {
	householdMembers,
	ledgerAccountHolders,
	transactionShares,
	transactions,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import type { Viewer } from "@/routes/accounts/accounts.service";
import { partsOf } from "@/routes/sharing/split";

function invalidShares(message: string): AppError {
	return new AppError(422, "validation_error", "Invalid request", [
		{ field: "shares", message },
	]);
}

/** Sharing is for the households that turned it on. */
export function assertSharingEnabled(viewer: Viewer): void {
	if (!viewer.membership.household.expenseSharing) {
		throw new AppError(
			409,
			"sharing_disabled",
			"This household doesn't settle shared expenses",
		);
	}
}

/**
 * Shares a transaction among members: checks the split, then records each
 * one's part, and who paid: the one holder of its account. A joint account
 * holds money already shared: nothing to settle.
 */
export async function applySharing(
	tx: Tx,
	viewer: Viewer,
	row: { id: string; accountId: string; amount: number },
	split: ShareSplit,
): Promise<void> {
	assertSharingEnabled(viewer);
	const householdId = viewer.membership.household.id;
	const [holders, members] = await Promise.all([
		tx
			.select({ userId: ledgerAccountHolders.userId })
			.from(ledgerAccountHolders)
			.where(eq(ledgerAccountHolders.accountId, row.accountId)),
		tx
			.select({ userId: householdMembers.userId })
			.from(householdMembers)
			.where(eq(householdMembers.householdId, householdId)),
	]);
	const [payer] = holders;
	if (holders.length !== 1 || !payer) {
		throw invalidShares("share_account_not_personal");
	}
	const result = partsOf(split, row.amount);
	if ("error" in result) {
		throw invalidShares(result.error);
	}
	const memberIds = new Set(members.map((member) => member.userId));
	if (!result.parts.every((part) => memberIds.has(part.userId))) {
		throw invalidShares("share_member_invalid");
	}
	await tx
		.delete(transactionShares)
		.where(eq(transactionShares.transactionId, row.id));
	await tx.insert(transactionShares).values(
		result.parts.map((part) => ({
			transactionId: row.id,
			householdId,
			userId: part.userId,
			amount: part.amount,
		})),
	);
	await tx
		.update(transactions)
		.set({ shareSplit: split, sharePaidBy: payer.userId })
		.where(eq(transactions.id, row.id));
}

/** Stops sharing a transaction. */
export async function clearSharing(
	tx: Tx,
	transactionId: string,
): Promise<void> {
	await tx
		.delete(transactionShares)
		.where(eq(transactionShares.transactionId, transactionId));
	await tx
		.update(transactions)
		.set({ shareSplit: null, sharePaidBy: null })
		.where(eq(transactions.id, transactionId));
}

/** How each of these transactions is shared, by transaction. */
export async function sharingOf(
	database: Pick<Tx, "select">,
	rows: {
		id: string;
		shareSplit: ShareSplit | null;
		sharePaidBy: string | null;
	}[],
): Promise<Map<string, TransactionSharing>> {
	const shared = rows.filter(
		(row) => row.shareSplit !== null && row.sharePaidBy !== null,
	);
	if (shared.length === 0) {
		return new Map();
	}
	const parts = await database
		.select()
		.from(transactionShares)
		.where(
			inArray(
				transactionShares.transactionId,
				shared.map((row) => row.id),
			),
		);
	return new Map(
		shared.map((row) => [
			row.id,
			{
				paidBy: row.sharePaidBy ?? "",
				split: row.shareSplit as ShareSplit,
				parts: parts
					.filter((part) => part.transactionId === row.id)
					.map(({ userId, amount }) => ({ userId, amount })),
			},
		]),
	);
}
