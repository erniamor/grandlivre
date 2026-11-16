import type { AdjustAccount, AdjustAccountResult } from "@repo/schemas";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ledgerAccounts } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { publishHouseholdEvent } from "@/lib/events";
import { movementsOf, type Viewer } from "@/routes/accounts/accounts.service";
import {
	accountAccess,
	assertAccount,
	recordTransaction,
} from "@/routes/transactions/transactions.service";

/**
 * Brings an account's balance to what it really holds on a day: the cash
 * counted in a wallet, the balance a bank shows. The gap is recorded as an
 * adjustment on that day, by a holder of the account: an expense when it
 * holds less (what was spent and not noted), an income when it holds more.
 * Nothing is recorded when there is no gap.
 */
export async function adjustAccount(
	viewer: Viewer,
	accountId: string,
	{ balance, date, tagId }: AdjustAccount,
): Promise<AdjustAccountResult> {
	const householdId = viewer.membership.household.id;
	return db.transaction(async (tx) => {
		const [account] = await tx
			.select({ openingBalance: ledgerAccounts.openingBalance })
			.from(ledgerAccounts)
			.where(
				and(
					eq(ledgerAccounts.id, accountId),
					eq(ledgerAccounts.householdId, householdId),
				),
			)
			// Two adjustments at once would both count the same gap
			.for("update");
		if (!account) {
			throw new AppError(404, "not_found", "Account not found");
		}
		const movements = await movementsOf(householdId, tx, { until: date });
		const expected = account.openingBalance + (movements.get(accountId) ?? 0);
		const gap = balance - expected;
		if (gap === 0) {
			// Who may adjust is checked even when there is nothing to record
			assertAccount(await accountAccess(tx, viewer), accountId, "accountId");
			return { adjustment: null, balance: expected };
		}
		const adjustment = await recordTransaction(
			tx,
			viewer,
			{
				type: gap < 0 ? "expense" : "income",
				accountId,
				date,
				payee: null,
				note: null,
				lines: [{ amount: Math.abs(gap), tagId: tagId ?? null }],
			},
			{ origin: "adjustment" },
		).catch((error: unknown) => {
			// Its one line's tag is the `tagId` sent
			if (error instanceof AppError && Array.isArray(error.details)) {
				throw new AppError(
					error.status,
					error.code,
					error.message,
					error.details.map((detail: { field: string; message: string }) =>
						detail.field === "lines.0.tagId"
							? { ...detail, field: "tagId" }
							: detail,
					),
				);
			}
			throw error;
		});
		await publishHouseholdEvent(tx, householdId, "transactions");
		return { adjustment, balance };
	});
}
