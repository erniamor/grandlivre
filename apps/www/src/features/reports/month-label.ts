/** A month ("2026-11") in words: "Nov" for an axis, "November 2026" in full. */
export function monthLabel(
	month: string,
	locale: string,
	style: "short" | "long",
): string {
	return new Intl.DateTimeFormat(locale, {
		month: style,
		...(style === "long" ? { year: "numeric" } : {}),
		timeZone: "UTC",
	}).format(new Date(`${month}-01T00:00:00Z`));
}
