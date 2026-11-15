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
