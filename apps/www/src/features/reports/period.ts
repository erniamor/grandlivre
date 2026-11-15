/** A period of calendar days, both included: "2026-11-01" to "2026-11-30". */
export interface Period {
	from: string;
	to: string;
}

/** What a period is: a calendar month, a calendar year, or other days. */
export type PeriodKind = "month" | "year" | "custom";

const pad = (n: number) => String(n).padStart(2, "0");

/** The last day of a month (1 to 12): 28 to 31. */
function lastDayOf(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The year and month (1 to 12) of a day. */
function yearMonthOf(day: string): [number, number] {
	const [year = 0, month = 1] = day.split("-").map(Number);
	return [year, month];
}

export function monthPeriod(year: number, month: number): Period {
	return {
		from: `${year}-${pad(month)}-01`,
		to: `${year}-${pad(month)}-${pad(lastDayOf(year, month))}`,
	};
}

export function yearPeriod(year: number): Period {
	return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/** The month a day is in. */
export function monthOf(day: string): Period {
	return monthPeriod(...yearMonthOf(day));
}

/** The year a day is in. */
export function yearOf(day: string): Period {
	return yearPeriod(yearMonthOf(day)[0]);
}

export function periodKind({ from, to }: Period): PeriodKind {
	const month = monthOf(from);
	if (month.from === from && month.to === to) {
		return "month";
	}
	const year = yearOf(from);
	return year.from === from && year.to === to ? "year" : "custom";
}

/** The month or the year before (-1) or after (1); other days don't move. */
export function shiftPeriod(period: Period, step: -1 | 1): Period {
	const [year, month] = yearMonthOf(period.from);
	switch (periodKind(period)) {
		case "month": {
			const zeroBased = month - 1 + step;
			return monthPeriod(
				year + Math.floor(zeroBased / 12),
				(((zeroBased % 12) + 12) % 12) + 1,
			);
		}
		case "year":
			return yearPeriod(year + step);
		case "custom":
			return period;
	}
}

/** Whether a period is valid: two days, the first not after the second. */
export function isPeriod(from: string, to: string): boolean {
	// Days written "YYYY-MM-DD" compare as text
	return from <= to;
}

/** A day of the period, read and written in UTC: the same everywhere. */
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);

/** The period in words: "November 2026", "2026", or its first and last days. */
export function periodLabel(period: Period, locale: string): string {
	switch (periodKind(period)) {
		case "month":
			return new Intl.DateTimeFormat(locale, {
				month: "long",
				year: "numeric",
				timeZone: "UTC",
			}).format(asDate(period.from));
		case "year":
			return period.from.slice(0, 4);
		case "custom":
			return new Intl.DateTimeFormat(locale, {
				dateStyle: "medium",
				timeZone: "UTC",
			}).formatRange(asDate(period.from), asDate(period.to));
	}
}

/** The twelve months ending with the month of `day`, that one included. */
export function twelveMonthsEnding(day: string): Period {
	const [year, month] = yearMonthOf(day);
	const zeroBased = month - 1 - 11;
	const first = monthPeriod(
		year + Math.floor(zeroBased / 12),
		(((zeroBased % 12) + 12) % 12) + 1,
	);
	return { from: first.from, to: monthOf(day).to };
}
