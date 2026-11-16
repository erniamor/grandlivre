/**
 * Formats a calendar day ("2026-11-14") in words, the way `locale` writes
 * it: "Saturday, November 14, 2026". The day has no time zone: it is read
 * and written in UTC, so it is the same on the server and in every browser.
 */
export function formatDay(day: string, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		dateStyle: "full",
		timeZone: "UTC",
	}).format(new Date(`${day}T00:00:00Z`));
}

/**
 * Formats a calendar day in few words, for lists: "Nov 14, 2026",
 * "14 nov. 2026". Read and written in UTC, as `formatDay`.
 */
export function formatShortDay(day: string, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeZone: "UTC",
	}).format(new Date(`${day}T00:00:00Z`));
}

/**
 * Today, as a calendar day ("2026-11-15"), in a time zone: a household's
 * day, which can differ from the browser's.
 */
export function todayIn(timeZone: string, now: Date = new Date()): string {
	// en-CA writes dates as YYYY-MM-DD
	return new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(now);
}
