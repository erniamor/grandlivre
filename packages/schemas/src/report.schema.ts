import { z } from "zod";

/**
 * Longest period a monthly report covers: five years. A report by tag has
 * no limit.
 */
export const REPORT_MAX_MONTHS = 60;

/**
 * What a tag gathered over a period, in minor units: the lines of expenses
 * and of incomes on it, apart. Transfers are neither. Both are zero or
 * positive; how to show them (a refund lowering an expense...) is up to the
 * front ends.
 */
export const tagTotalSchema = z.object({
	/** Null for the uncategorized lines. */
	tagId: z.uuid().nullable(),
	/**
	 * The uncategorized lines of the transactions set aside as undetermined,
	 * apart from those still to categorize. Always false for a tag.
	 */
	undetermined: z.boolean(),
	expense: z.number().int(),
	income: z.number().int(),
});

export type TagTotal = z.infer<typeof tagTotalSchema>;

/** The household's expenses and incomes over a period, tag by tag. */
export const tagReportSchema = z.object({
	/** The first day of the period, included. */
	from: z.iso.date(),
	/** The last day of the period, included. */
	to: z.iso.date(),
	/**
	 * The tags that had a line in the period, each once, and the
	 * uncategorized lines if any: those to categorize and those undetermined
	 * apart. The amounts are each tag's own: the tags
	 * under it aren't included.
	 */
	tags: z.array(tagTotalSchema),
});

export type TagReport = z.infer<typeof tagReportSchema>;

/** What a month gathered, in minor units. */
export const monthTotalSchema = z.object({
	/** "2026-11". */
	month: z.string().regex(/^\d{4}-\d{2}$/),
	/** All the month's expense lines. */
	expense: z.number().int(),
	/** All the month's income lines. */
	income: z.number().int(),
	/**
	 * The same, tag by tag, as in a report by tag: to show a month the way
	 * the report shows the period (a refund lowering its tag's expenses).
	 */
	tags: z.array(tagTotalSchema),
});

export type MonthTotal = z.infer<typeof monthTotalSchema>;

/** The household's expenses and incomes month by month. */
export const monthlyReportSchema = z.object({
	/** Every month of the period, in order, empty ones included. */
	months: z.array(monthTotalSchema),
});

export type MonthlyReport = z.infer<typeof monthlyReportSchema>;
