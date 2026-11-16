import { z } from "zod";
import { dateTimeSchema } from "./common";
import { transactionAmountSchema } from "./transaction.schema";

/**
 * What a budget covers:
 * - "month": each calendar month (groceries, outings);
 * - "year": each calendar year, for what comes once or twice a year
 *   (insurance, holidays).
 */
export const BUDGET_PERIODS = ["month", "year"] as const;

export const budgetPeriodSchema = z.enum(
	BUDGET_PERIODS,
	"budget_period_invalid",
);

export type BudgetPeriod = z.infer<typeof budgetPeriodSchema>;

/** A calendar month: "2026-11". */
export const monthSchema = z
	.string("budget_month_invalid")
	.regex(/^\d{4}-(0[1-9]|1[0-2])$/, "budget_month_invalid");

/**
 * Sets the budget of a tag, from a month on: that month and the following
 * ones take it, the months before keep theirs. A budget on a tag covers
 * the tags under it.
 */
export const setBudgetSchema = z.strictObject({
	period: budgetPeriodSchema,
	/** In minor units, for the whole period: a month, or a year. */
	amount: transactionAmountSchema,
	from: monthSchema,
});

export type SetBudget = z.infer<typeof setBudgetSchema>;

/** A budget as set, from a month on. */
export const budgetSchema = z.object({
	tagId: z.uuid(),
	period: budgetPeriodSchema,
	amount: z.number().int(),
	/** The month it applies from. */
	from: monthSchema,
	updatedAt: dateTimeSchema,
});

export type Budget = z.infer<typeof budgetSchema>;

/**
 * Where a budget stands, in a month: what was spent over its period (the
 * month, or the year of the month), and what the recurring transactions
 * still plan to spend in it. Amounts in minor units.
 */
export const budgetStatusSchema = z.object({
	tagId: z.uuid(),
	period: budgetPeriodSchema,
	amount: z.number().int(),
	/** The month the budget applies from. */
	since: monthSchema,
	/**
	 * The expenses on the tag and the tags under it, refunds taken off;
	 * never below zero. Every account counts, as in the reports.
	 */
	spent: z.number().int(),
	/**
	 * The days of the recurring expenses still to come in the period, from
	 * today, and the ones waiting to be confirmed.
	 */
	upcoming: z.number().int(),
});

export type BudgetStatus = z.infer<typeof budgetStatusSchema>;

/** The household's budgets in a month. */
export const budgetsMonthSchema = z.object({
	month: monthSchema,
	/** Each budget in force that month, monthly ones first. */
	budgets: z.array(budgetStatusSchema),
});

export type BudgetsMonth = z.infer<typeof budgetsMonthSchema>;

/** What a tag usually costs, to suggest a budget. */
export const budgetSuggestionSchema = z.object({
	tagId: z.uuid(),
	/** The average of the 3 whole months before the month, rounded. */
	month: z.number().int(),
	/** The sum of the 12 whole months before the month. */
	year: z.number().int(),
});

export type BudgetSuggestion = z.infer<typeof budgetSuggestionSchema>;
