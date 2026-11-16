import type {
	Budget,
	BudgetPeriod,
	BudgetStatus,
	BudgetSuggestion,
	BudgetsMonth,
	SetBudget,
} from "@repo/schemas";
import {
	and,
	asc,
	desc,
	eq,
	gt,
	gte,
	isNotNull,
	lte,
	ne,
	sql,
} from "drizzle-orm";
import { db } from "@/db/client";
import {
	budgets,
	recurringOccurrences,
	recurringTransactionLines,
	recurringTransactions,
	tags,
	transactionLines,
	transactions,
} from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { publishHouseholdEvent } from "@/lib/events";
import type { Viewer } from "@/routes/accounts/accounts.service";
import {
	addMonths,
	firstDayOf,
	lastDayOf,
	monthOf,
} from "@/routes/budgets/months";
import { occurrencesBetween } from "@/routes/recurring/schedule";

type TagRow = { id: string; parentId: string | null };

/** The tags of a household, to find what is under each. */
function tagsOf(householdId: string): Promise<TagRow[]> {
	return db
		.select({ id: tags.id, parentId: tags.parentId })
		.from(tags)
		.where(eq(tags.householdId, householdId));
}

/** A tag and every tag under it. */
function subtree(rows: TagRow[], tagId: string): Set<string> {
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
	return ids;
}

/** A tag of the household, or 404: a tag from elsewhere isn't there. */
async function assertTag(householdId: string, tagId: string): Promise<void> {
	const [tag] = await db
		.select({ id: tags.id })
		.from(tags)
		.where(and(eq(tags.id, tagId), eq(tags.householdId, householdId)));
	if (!tag) {
		throw new AppError(404, "not_found", "Tag not found");
	}
}

// Raw SQL: conditional sums have no Drizzle helper; sums of bigint come back
// as numeric strings
const expenseSum =
	sql`coalesce(sum(${transactionLines.amount}) filter (where ${transactions.type} = 'expense'), 0)`.mapWith(
		Number,
	);
const incomeSum =
	sql`coalesce(sum(${transactionLines.amount}) filter (where ${transactions.type} = 'income'), 0)`.mapWith(
		Number,
	);

/**
 * What each tag spent from `from` to `to`, refunds (incomes on it) taken
 * off. Every account counts: only totals come out, as in the reports.
 */
async function spentByTag(
	householdId: string,
	from: string,
	to: string,
): Promise<Map<string, number>> {
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
		.where(
			and(
				eq(transactions.householdId, householdId),
				ne(transactions.type, "transfer"),
				isNotNull(transactionLines.tagId),
				gte(transactions.date, from),
				lte(transactions.date, to),
			),
		)
		.groupBy(transactionLines.tagId);
	return new Map(
		rows.flatMap(({ tagId, expense, income }) =>
			tagId ? [[tagId, expense - income]] : [],
		),
	);
}

/** What a set of tags spent, never below zero. */
function spentUnder(spent: Map<string, number>, tagIds: Set<string>): number {
	let total = 0;
	for (const tagId of tagIds) {
		total += spent.get(tagId) ?? 0;
	}
	return Math.max(0, total);
}

/** A planned expense: an amount on a tag, on a day. */
interface Planned {
	date: string;
	tagId: string;
	amount: number;
}

/**
 * The expenses the recurring transactions still plan, from `from` to `to`:
 * their days to come, from today on, and their days waiting for a member.
 */
async function plannedExpenses(
	householdId: string,
	today: string,
	from: string,
	to: string,
): Promise<Planned[]> {
	const [rules, lines, waiting] = await Promise.all([
		db
			.select()
			.from(recurringTransactions)
			.where(
				and(
					eq(recurringTransactions.householdId, householdId),
					eq(recurringTransactions.type, "expense"),
					lte(recurringTransactions.nextDate, to),
				),
			),
		db
			.select({
				recurringId: recurringTransactionLines.recurringId,
				tagId: recurringTransactionLines.tagId,
				amount: recurringTransactionLines.amount,
			})
			.from(recurringTransactionLines)
			.where(
				and(
					eq(recurringTransactionLines.householdId, householdId),
					isNotNull(recurringTransactionLines.tagId),
				),
			),
		db
			.select({
				recurringId: recurringOccurrences.recurringId,
				date: recurringOccurrences.date,
			})
			.from(recurringOccurrences)
			.innerJoin(
				recurringTransactions,
				eq(recurringTransactions.id, recurringOccurrences.recurringId),
			)
			.where(
				and(
					eq(recurringOccurrences.householdId, householdId),
					eq(recurringOccurrences.status, "pending"),
					eq(recurringTransactions.type, "expense"),
					gte(recurringOccurrences.date, from),
					lte(recurringOccurrences.date, to),
				),
			),
	]);
	const linesOf = (recurringId: string) =>
		lines.flatMap((line) =>
			line.recurringId === recurringId && line.tagId
				? [{ tagId: line.tagId, amount: line.amount }]
				: [],
		);
	const start = [from, today].sort().at(-1) ?? from;
	const toCome = rules.flatMap((rule) =>
		rule.nextDate === null
			? []
			: occurrencesBetween(
					{
						unit: rule.unit,
						interval: rule.interval,
						startDate: rule.startDate,
						endDate: rule.endDate,
					},
					// Its days before its next one are handled already
					[start, rule.nextDate].sort().at(-1) ?? start,
					to,
				).flatMap((date) =>
					linesOf(rule.id).map((line) => ({ date, ...line })),
				),
	);
	const waitingDays = waiting.flatMap(({ recurringId, date }) =>
		linesOf(recurringId).map((line) => ({ date, ...line })),
	);
	return [...toCome, ...waitingDays];
}

/** What is planned on a set of tags. */
function plannedUnder(planned: Planned[], tagIds: Set<string>): number {
	return planned
		.filter((each) => tagIds.has(each.tagId))
		.reduce((total, each) => total + each.amount, 0);
}

/** The household's current month, in its time zone. */
function currentMonth(viewer: Viewer): string {
	return monthOf(todayIn(viewer.membership.household.timeZone));
}

/**
 * The budgets in force in a month, and where they stand: a monthly budget
 * over the month, a yearly one over the month's year.
 */
export async function listBudgets(
	viewer: Viewer,
	month = currentMonth(viewer),
): Promise<BudgetsMonth> {
	const household = viewer.membership.household;
	const versions = await db
		.select()
		.from(budgets)
		.where(
			and(
				eq(budgets.householdId, household.id),
				lte(budgets.fromMonth, firstDayOf(month)),
			),
		)
		.orderBy(asc(budgets.tagId), desc(budgets.fromMonth));
	// The last version of each tag (the first of its rows, the most recent
	// first); a stopped one means no budget
	const latest = new Map<string, (typeof versions)[number]>();
	for (const version of versions) {
		if (!latest.has(version.tagId)) {
			latest.set(version.tagId, version);
		}
	}
	const inForce = [...latest.values()].flatMap((version) =>
		version.amount === null ? [] : [{ ...version, amount: version.amount }],
	);
	if (inForce.length === 0) {
		return { month, budgets: [] };
	}

	const year = month.slice(0, 4);
	const periods: Record<BudgetPeriod, { from: string; to: string }> = {
		month: { from: firstDayOf(month), to: lastDayOf(month) },
		year: { from: `${year}-01-01`, to: `${year}-12-31` },
	};
	const today = todayIn(household.timeZone);
	const hasYearly = inForce.some((version) => version.period === "year");
	const [tagRows, spentInMonth, spentInYear, plannedInMonth, plannedInYear] =
		await Promise.all([
			tagsOf(household.id),
			spentByTag(household.id, periods.month.from, periods.month.to),
			hasYearly
				? spentByTag(household.id, periods.year.from, periods.year.to)
				: new Map<string, number>(),
			plannedExpenses(
				household.id,
				today,
				periods.month.from,
				periods.month.to,
			),
			hasYearly
				? plannedExpenses(
						household.id,
						today,
						periods.year.from,
						periods.year.to,
					)
				: [],
		]);

	const statuses: BudgetStatus[] = inForce.map((version) => {
		const under = subtree(tagRows, version.tagId);
		const yearly = version.period === "year";
		return {
			tagId: version.tagId,
			period: version.period,
			amount: version.amount,
			since: monthOf(version.fromMonth),
			spent: spentUnder(yearly ? spentInYear : spentInMonth, under),
			upcoming: plannedUnder(yearly ? plannedInYear : plannedInMonth, under),
		};
	});
	return {
		month,
		budgets: statuses.sort(
			(a, b) => (a.period === "month" ? 0 : 1) - (b.period === "month" ? 0 : 1),
		),
	};
}

/**
 * Sets the budget of a tag from a month on, for every month after too:
 * a later change is replaced. The months before keep theirs.
 */
export async function setBudget(
	viewer: Viewer,
	tagId: string,
	{ period, amount, from }: SetBudget,
): Promise<Budget> {
	const householdId = viewer.membership.household.id;
	await assertTag(householdId, tagId);
	const fromMonth = firstDayOf(from);
	return db.transaction(async (tx) => {
		await tx
			.delete(budgets)
			.where(and(eq(budgets.tagId, tagId), gt(budgets.fromMonth, fromMonth)));
		const [row] = await tx
			.insert(budgets)
			.values({
				householdId,
				tagId,
				period,
				amount,
				fromMonth,
				updatedBy: viewer.userId,
			})
			.onConflictDoUpdate({
				target: [budgets.tagId, budgets.fromMonth],
				set: { period, amount, updatedBy: viewer.userId },
			})
			.returning();
		if (!row || row.amount === null) {
			throw new Error("The budget was not set");
		}
		await publishHouseholdEvent(tx, householdId, "budgets");
		return {
			tagId,
			period: row.period,
			amount: row.amount,
			from,
			updatedAt: row.updatedAt.toISOString(),
		};
	});
}

/**
 * Stops the budget of a tag from a month on; the months before keep it.
 * Stopping a budget that isn't there changes nothing.
 */
export async function stopBudget(
	viewer: Viewer,
	tagId: string,
	from: string,
): Promise<void> {
	const householdId = viewer.membership.household.id;
	await assertTag(householdId, tagId);
	const fromMonth = firstDayOf(from);
	await db.transaction(async (tx) => {
		await tx
			.delete(budgets)
			.where(and(eq(budgets.tagId, tagId), gte(budgets.fromMonth, fromMonth)));
		const [before] = await tx
			.select()
			.from(budgets)
			.where(eq(budgets.tagId, tagId))
			.orderBy(desc(budgets.fromMonth))
			.limit(1);
		// A budget runs until then: a version without amount ends it
		if (before?.amount) {
			await tx.insert(budgets).values({
				householdId,
				tagId,
				period: before.period,
				amount: null,
				fromMonth,
				updatedBy: viewer.userId,
			});
		}
		await publishHouseholdEvent(tx, householdId, "budgets");
	});
}

/**
 * What a tag (and the tags under it) usually costs before a month: the
 * average of the 3 previous months, and the sum of the 12 previous ones.
 */
export async function suggestBudget(
	viewer: Viewer,
	tagId: string,
	month = currentMonth(viewer),
): Promise<BudgetSuggestion> {
	const householdId = viewer.membership.household.id;
	await assertTag(householdId, tagId);
	const under = subtree(await tagsOf(householdId), tagId);
	const before = addMonths(month, -1);
	const [threeMonths, twelveMonths] = await Promise.all([
		spentByTag(
			householdId,
			firstDayOf(addMonths(month, -3)),
			lastDayOf(before),
		),
		spentByTag(
			householdId,
			firstDayOf(addMonths(month, -12)),
			lastDayOf(before),
		),
	]);
	return {
		tagId,
		month: Math.round(spentUnder(threeMonths, under) / 3),
		year: spentUnder(twelveMonths, under),
	};
}
