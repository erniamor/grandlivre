// Calendar months ("2026-11") and their days, without time zone

/** The first day of a month: "2026-11-01". */
export function firstDayOf(month: string): string {
	return `${month}-01`;
}

/** The last day of a month: "2026-11-30". */
export function lastDayOf(month: string): string {
	const [year = 0, monthNumber = 1] = month.split("-").map(Number);
	// Day 0 of the next month: the last day of this one
	const day = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
	return `${month}-${String(day).padStart(2, "0")}`;
}

/** The month `count` months after `month` (before, when negative). */
export function addMonths(month: string, count: number): string {
	const [year = 0, monthNumber = 1] = month.split("-").map(Number);
	const total = year * 12 + (monthNumber - 1) + count;
	return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** The month of a day: "2026-11-15" is "2026-11". */
export function monthOf(day: string): string {
	return day.slice(0, 7);
}
