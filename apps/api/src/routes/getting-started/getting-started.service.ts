import type { GettingStarted, UpdateGettingStarted } from "@repo/schemas";
import { and, count, eq, gt, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db/client";
import {
	budgets,
	householdInvitations,
	householdMembers,
	ledgerAccounts,
	recurringTransactions,
	statementImports,
	tags,
} from "@/db/schema";
import type { Viewer } from "@/routes/accounts/accounts.service";
import { countUncategorized } from "@/routes/transactions/categorize.service";
import { accountAccess } from "@/routes/transactions/transactions.service";

/** Whether a count query found any row. */
async function any(query: Promise<{ total: number }[]>): Promise<boolean> {
	const [row] = await query;
	return (row?.total ?? 0) > 0;
}

/**
 * Where the household stands in its first steps, as the member sees it,
 * from its data: nothing of it is stored but whether they hid it.
 */
export async function gettingStarted(viewer: Viewer): Promise<GettingStarted> {
	const householdId = viewer.membership.household.id;
	const [
		[member],
		access,
		hasTags,
		hasMembers,
		hasInvitations,
		imported,
		recurring,
		hasBudgets,
		uncategorized,
	] = await Promise.all([
		db
			.select({ hidden: householdMembers.gettingStartedHidden })
			.from(householdMembers)
			.where(
				and(
					eq(householdMembers.householdId, householdId),
					eq(householdMembers.userId, viewer.userId),
				),
			),
		accountAccess(db, viewer),
		any(
			db
				.select({ total: count() })
				.from(tags)
				.where(eq(tags.householdId, householdId)),
		),
		// Another member than this one
		any(
			db
				.select({ total: count() })
				.from(householdMembers)
				.where(
					and(
						eq(householdMembers.householdId, householdId),
						ne(householdMembers.userId, viewer.userId),
					),
				),
		),
		any(
			db
				.select({ total: count() })
				.from(householdInvitations)
				.where(
					and(
						eq(householdInvitations.householdId, householdId),
						gt(householdInvitations.expiresAt, new Date()),
					),
				),
		),
		any(
			db
				.select({ total: count() })
				.from(statementImports)
				.where(eq(statementImports.householdId, householdId)),
		),
		any(
			db
				.select({ total: count() })
				.from(recurringTransactions)
				.where(eq(recurringTransactions.householdId, householdId)),
		),
		any(
			db
				.select({ total: count() })
				.from(budgets)
				// A budget stopped from a month on has no amount
				.where(
					and(eq(budgets.householdId, householdId), isNotNull(budgets.amount)),
				),
		),
		countUncategorized(viewer),
	]);
	const accounts = await db
		.select({ id: ledgerAccounts.id, type: ledgerAccounts.type })
		.from(ledgerAccounts)
		.where(eq(ledgerAccounts.householdId, householdId));
	const open = accounts.filter((account) => !access.get(account.id)?.archived);
	return {
		hidden: member?.hidden ?? false,
		steps: {
			tags: hasTags,
			accounts: open.length > 0,
			wallet: open.some(
				(account) =>
					account.type === "cash" && access.get(account.id)?.isHolder,
			),
			members: hasMembers || hasInvitations,
			imported,
			categorized: uncategorized === 0,
			recurring,
			budgets: hasBudgets,
		},
		uncategorized,
	};
}

/** Hides the household's first steps from the member, or shows them again. */
export async function updateGettingStarted(
	viewer: Viewer,
	{ hidden }: UpdateGettingStarted,
): Promise<GettingStarted> {
	await db
		.update(householdMembers)
		.set({ gettingStartedHidden: hidden })
		.where(
			and(
				eq(householdMembers.householdId, viewer.membership.household.id),
				eq(householdMembers.userId, viewer.userId),
			),
		);
	return gettingStarted(viewer);
}
