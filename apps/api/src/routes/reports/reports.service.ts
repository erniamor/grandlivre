import type { MonthlyReport, TagReport } from "@repo/schemas";
import {
	and,
	eq,
	gte,
	inArray,
	isNotNull,
	lte,
	ne,
	type SQL,
	sql,
} from "drizzle-orm";
import { db } from "@/db/client";
import {
	ledgerAccountHolders,
	ledgerAccounts,
	tags,
	transactionLines,
	transactions,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import type { Viewer } from "@/routes/accounts/accounts.service";
import {
	type MonthlyReportQuery,
	monthsSpanned,
	type TagReportQuery,
} from "@/routes/reports/reports.schemas";

/**
 * Only an account whose details the viewer may see can narrow a report: a
 * report on an account that only shows its balance would show, tag by tag,
 * what that account hides. The household's reports count every account.
 */
async function assertCanNarrowTo(
	{ userId, membership }: Viewer,
	accountId: string,
): Promise<void> {
	const [account] = await db
		.select({
			visibility: ledgerAccounts.visibility,
			holder: ledgerAccountHolders.userId,
		})
		.from(ledgerAccounts)
		.leftJoin(
			ledgerAccountHolders,
			and(
				eq(ledgerAccountHolders.accountId, ledgerAccounts.id),
				eq(ledgerAccountHolders.userId, userId),
			),
		)
		.where(
			and(
				eq(ledgerAccounts.id, accountId),
				eq(ledgerAccounts.householdId, membership.household.id),
			),
		);
	if (!account) {
		throw new AppError(422, "validation_error", "Invalid request", [
			{ field: "accountId", message: "transaction_account_invalid" },
		]);
	}
	if (account.visibility !== "details" && account.holder === null) {
		throw new AppError(
			403,
			"forbidden",
			"This account only shows its balance: it can't narrow a report",
		);
	}
}

/** The household's expense and income lines of a period: transfers have none. */
function linesOfPeriod(
	householdId: string,
	{ from, to, accountId }: { from: string; to: string; accountId?: string },
): SQL | undefined {
	return and(
		eq(transactions.householdId, householdId),
		ne(transactions.type, "transfer"),
		gte(transactions.date, from),
		lte(transactions.date, to),
		accountId ? eq(transactions.accountId, accountId) : undefined,
	);
}

// Raw SQL: conditional sums have no Drizzle helper. Sums of bigint come back
// as numeric strings, hence mapWith(Number).
const expenseSum =
	sql`coalesce(sum(${transactionLines.amount}) filter (where ${transactions.type} = 'expense'), 0)`.mapWith(
		Number,
	);
const incomeSum =
	sql`coalesce(sum(${transactionLines.amount}) filter (where ${transactions.type} = 'income'), 0)`.mapWith(
		Number,
	);

/** What each tag gathered over the period, expenses and incomes apart. */
export async function tagReport(
	viewer: Viewer,
	query: TagReportQuery,
): Promise<TagReport> {
	if (query.accountId) {
		await assertCanNarrowTo(viewer, query.accountId);
	}
	const rows = await db
		.select({
			tagId: transactionLines.tagId,
			expense: expenseSum,
			income: incomeSum,
		})
		.from(transactionLines)
		.innerJoin(
			transactions,
			eq(transactions.id, transactionLines.transactionId),
		)
		.where(linesOfPeriod(viewer.membership.household.id, query))
		.groupBy(transactionLines.tagId);
	return { from: query.from, to: query.to, tags: rows };
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
	if (!rows.some((row) => row.id === tagId)) {
		throw new AppError(422, "validation_error", "Invalid request", [
			{ field: "tagId", message: "transaction_tag_invalid" },
		]);
	}
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

/** Every month a period touches, in order: "2026-11", "2026-12", "2027-01"... */
function monthsOf(from: string, to: string): string[] {
	const [year = 0, month = 1] = from.split("-").map(Number);
	return Array.from({ length: monthsSpanned(from, to) }, (_, index) => {
		const zeroBased = month - 1 + index;
		const y = year + Math.floor(zeroBased / 12);
		const m = (zeroBased % 12) + 1;
		return `${y}-${String(m).padStart(2, "0")}`;
	});
}

/** The household's expenses and incomes month by month, empty months included. */
export async function monthlyReport(
	viewer: Viewer,
	query: MonthlyReportQuery,
): Promise<MonthlyReport> {
	const householdId = viewer.membership.household.id;
	if (query.accountId) {
		await assertCanNarrowTo(viewer, query.accountId);
	}
	const tagIds = query.tagId
		? await tagSubtree(householdId, query.tagId)
		: undefined;
	// Raw SQL: the month of a day has no Drizzle helper
	const month = sql<string>`to_char(${transactions.date}, 'YYYY-MM')`;
	const rows = await db
		.select({ month, expense: expenseSum, income: incomeSum })
		.from(transactionLines)
		.innerJoin(
			transactions,
			eq(transactions.id, transactionLines.transactionId),
		)
		.where(
			and(
				linesOfPeriod(householdId, query),
				tagIds
					? and(
							isNotNull(transactionLines.tagId),
							inArray(transactionLines.tagId, tagIds),
						)
					: undefined,
			),
		)
		.groupBy(month);
	const byMonth = new Map(rows.map((row) => [row.month, row]));
	return {
		months: monthsOf(query.from, query.to).map((each) => ({
			month: each,
			expense: byMonth.get(each)?.expense ?? 0,
			income: byMonth.get(each)?.income ?? 0,
		})),
	};
}
