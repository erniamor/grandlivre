import type { RecurrenceSchedule } from "@repo/schemas";

/** A calendar day ("2026-11-15") as a date at midnight UTC, for arithmetic. */
function toUtc(day: string): Date {
	return new Date(`${day}T00:00:00Z`);
}

function toDay(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number): number {
	// Day 0 of the next month: the last day of this one
	return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * The `index`-th day of a schedule (0 is its first day), counted from the
 * first day each time: a monthly date of the 31st falls on the last day of
 * a shorter month, and is back on the 31st the month after.
 */
export function occurrenceAt(
	{ unit, interval, startDate }: Omit<RecurrenceSchedule, "endDate">,
	index: number,
): string {
	const start = toUtc(startDate);
	if (unit === "week") {
		start.setUTCDate(start.getUTCDate() + 7 * interval * index);
		return toDay(start);
	}
	const months = (unit === "year" ? 12 : 1) * interval * index;
	const total = start.getUTCFullYear() * 12 + start.getUTCMonth() + months;
	const year = Math.floor(total / 12);
	const month = total % 12;
	const day = Math.min(start.getUTCDate(), daysInMonth(year, month));
	return toDay(new Date(Date.UTC(year, month, day)));
}

/**
 * The first day of the schedule on or after `from`, or null when the
 * schedule has ended by then.
 */
export function nextOccurrence(
	schedule: RecurrenceSchedule,
	from: string,
): string | null {
	// A first guess from the elapsed time, never past the answer (each
	// period counted at its longest), then a few steps forward
	const elapsedDays = Math.max(
		0,
		(toUtc(from).getTime() - toUtc(schedule.startDate).getTime()) / 86_400_000,
	);
	const longestPeriod =
		{ week: 7, month: 31, year: 366 }[schedule.unit] * schedule.interval;
	let index = Math.max(0, Math.floor(elapsedDays / longestPeriod) - 1);
	let day = occurrenceAt(schedule, index);
	while (day < from) {
		index += 1;
		day = occurrenceAt(schedule, index);
	}
	return schedule.endDate !== null && day > schedule.endDate ? null : day;
}

/** The days of the schedule from `from` to `to`, both included. */
export function occurrencesBetween(
	schedule: RecurrenceSchedule,
	from: string,
	to: string,
): string[] {
	const days: string[] = [];
	let day = nextOccurrence(schedule, from);
	while (day !== null && day <= to) {
		days.push(day);
		const next = toUtc(day);
		next.setUTCDate(next.getUTCDate() + 1);
		day = nextOccurrence(schedule, toDay(next));
	}
	return days;
}
