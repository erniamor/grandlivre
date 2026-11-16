import type { SharePart, ShareSplit, TransactionSharing } from "@repo/schemas";
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
 * Checks a split for an amount paid from an account: the household settles
 * shared expenses, the account has one holder, who paid, and the members
 * are the household's. Gives the payer and each one's part.
 */
export async function checkSharing(
	tx: Tx,
	household: { id: string; expenseSharing: boolean },
	accountId: string,
	amount: number,
	split: ShareSplit,
): Promise<{ payer: string; parts: SharePart[] }> {
	if (!household.expenseSharing) {
		throw new AppError(
			409,
			"sharing_disabled",
			"This household doesn't settle shared expenses",
		);
	}
	const [holders, members] = await Promise.all([
		tx
			.select({ userId: ledgerAccountHolders.userId })
			.from(ledgerAccountHolders)
			.where(eq(ledgerAccountHolders.accountId, accountId)),
		tx
			.select({ userId: householdMembers.userId })
			.from(householdMembers)
			.where(eq(householdMembers.householdId, household.id)),
	]);
	const [payer] = holders;
	if (holders.length !== 1 || !payer) {
		throw invalidShares("share_account_not_personal");
	}
	const result = partsOf(split, amount);
	if ("error" in result) {
		throw invalidShares(result.error);
	}
	const memberIds = new Set(members.map((member) => member.userId));
	if (!result.parts.every((part) => memberIds.has(part.userId))) {
		throw invalidShares("share_member_invalid");
	}
	return { payer: payer.userId, parts: result.parts };
}

/** Records each one's part of a transaction, and who paid. */
async function writeSharing(
	tx: Tx,
	householdId: string,
	transactionId: string,
	split: ShareSplit,
	{ payer, parts }: { payer: string; parts: SharePart[] },
): Promise<void> {
	await tx
		.delete(transactionShares)
		.where(eq(transactionShares.transactionId, transactionId));
	await tx.insert(transactionShares).values(
		parts.map((part) => ({
			transactionId,
			householdId,
			userId: part.userId,
			amount: part.amount,
		})),
	);
	await tx
		.update(transactions)
		.set({ shareSplit: split, sharePaidBy: payer })
		.where(eq(transactions.id, transactionId));
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
	const household = viewer.membership.household;
	const checked = await checkSharing(
		tx,
		household,
		row.accountId,
		row.amount,
		split,
	);
	await writeSharing(tx, household.id, row.id, split, checked);
}

/**
 * Shares a transaction a recurring transaction recorded on its own, as it
 * says, when it still can: the household still settles shared expenses,
 * the account still has one holder, the members are still there. Otherwise
 * the transaction stays unshared, for a member to share by hand.
 */
export async function shareRecorded(
	tx: Tx,
	household: { id: string; expenseSharing: boolean },
	row: { id: string; accountId: string; amount: number },
	split: ShareSplit,
): Promise<boolean> {
	try {
		const checked = await checkSharing(
			tx,
			household,
			row.accountId,
			row.amount,
			split,
		);
		await writeSharing(tx, household.id, row.id, split, checked);
		return true;
	} catch (error) {
		if (error instanceof AppError) {
			return false;
		}
		throw error;
	}
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
