import type { RecurrenceSchedule, RecurrenceUnit } from "@repo/schemas";
import { m } from "@/paraglide/messages";

const every: Record<RecurrenceUnit, () => string> = {
	week: m.recurrence_every_week,
	month: m.recurrence_every_month,
	year: m.recurrence_every_year,
};

const everyN: Record<RecurrenceUnit, (inputs: { count: number }) => string> = {
	week: m.recurrence_every_n_weeks,
	month: m.recurrence_every_n_months,
	year: m.recurrence_every_n_years,
};

/** How often a schedule repeats, in words: "Every month", "Every 2 weeks". */
export function scheduleLabel({
	unit,
	interval,
}: Pick<RecurrenceSchedule, "unit" | "interval">): string {
	return interval === 1 ? every[unit]() : everyN[unit]({ count: interval });
}
