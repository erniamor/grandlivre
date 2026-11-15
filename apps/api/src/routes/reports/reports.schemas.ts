import { calendarDateSchema, REPORT_MAX_MONTHS } from "@repo/schemas";
import { z } from "zod";

/** The number of calendar months a period touches: 1 within a month. */
export function monthsSpanned(from: string, to: string): number {
	const [fromYear = 0, fromMonth = 0] = from.split("-").map(Number);
	const [toYear = 0, toMonth = 0] = to.split("-").map(Number);
	return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
}

const periodSchema = z
	.object({
		/** The first day, included. */
		from: calendarDateSchema,
		/** The last day, included. */
		to: calendarDateSchema,
		/** Only this account: one whose details the user may see. */
		accountId: z.uuid().optional(),
	})
	// Days written "YYYY-MM-DD" compare as text
	.refine((period) => period.from <= period.to, {
		message: "report_period_invalid",
		path: ["to"],
	});

export const tagReportQuerySchema = periodSchema;

export type TagReportQuery = z.infer<typeof tagReportQuerySchema>;

export const monthlyReportQuerySchema = periodSchema
	.safeExtend({
		/** Only the lines on this tag or on a tag under it. */
		tagId: z.uuid().optional(),
	})
	.refine(
		(period) => monthsSpanned(period.from, period.to) <= REPORT_MAX_MONTHS,
		{ message: "report_period_too_long", path: ["from"] },
	);

export type MonthlyReportQuery = z.infer<typeof monthlyReportQuerySchema>;
