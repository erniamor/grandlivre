import type { Period } from "@/features/reports/period";
import type { ReportView } from "@/features/reports/report-tree";

/**
 * This month up to today, and last month up to the same day (its last day
 * when shorter): what compares fairly early in the month.
 */
export function monthToDate(today: string): {
	current: Period;
	previous: Period;
} {
	const [year = 0, month = 1, day = 1] = today.split("-").map(Number);
	const previousYear = month === 1 ? year - 1 : year;
	const previousMonth = month === 1 ? 12 : month - 1;
	// Day 0 of a month: the last day of the one before
	const previousLength = new Date(
		Date.UTC(previousYear, previousMonth, 0),
	).getUTCDate();
	const pad = (value: number) => String(value).padStart(2, "0");
	const previousStart = `${previousYear}-${pad(previousMonth)}-01`;
	return {
		current: { from: `${year}-${pad(month)}-01`, to: today },
		previous: {
			from: previousStart,
			to: `${previousYear}-${pad(previousMonth)}-${pad(Math.min(day, previousLength))}`,
		},
	};
}

/** The month's figures, counted as the reports count them (a refund lowers its tag's expenses). */
export interface KeyFigures {
	/** In minor units. */
	expenses: number;
	incomes: number;
	/** Incomes minus expenses: negative when the month cost more than it brought in. */
	savings: number;
	/** Savings over incomes; null without incomes yet. */
	savingsRate: number | null;
	/** How the expenses compare with last month at the same day: 0.08 for 8 % more; null without expenses then. */
	expensesChange: number | null;
}

export function keyFigures(
	current: ReportView,
	previous: ReportView,
): KeyFigures {
	const expenses = current.expenses.total;
	const incomes = current.incomes.total;
	const savings = incomes - expenses;
	const before = previous.expenses.total;
	return {
		expenses,
		incomes,
		savings,
		savingsRate: incomes > 0 ? savings / incomes : null,
		expensesChange: before > 0 ? expenses / before - 1 : null,
	};
}
