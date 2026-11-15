/** Today, as a calendar day ("2026-11-15"), in `timeZone`. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
	// en-CA writes dates as YYYY-MM-DD
	return new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(now);
}
