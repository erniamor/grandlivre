/**
 * An amount written by a bank ("1234.56", "35.9", "12"), in minor units;
 * null when it isn't one. Read from the text, never through a float.
 */
export function parseBankAmount(text: string): number | null {
	const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text.trim());
	if (!match) {
		return null;
	}
	const [, units, decimals = ""] = match;
	return Number(units) * 100 + Number(decimals.padEnd(2, "0"));
}

/** A day written YYYY/MM/DD (Desjardins), as YYYY-MM-DD; null otherwise. */
export function parseBankDate(text: string): string | null {
	const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(text.trim());
	if (!match) {
		return null;
	}
	const [, year, month, day] = match;
	const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
	// Rejects 2026/02/31 and the like
	return date.getUTCMonth() === Number(month) - 1
		? `${year}-${month}-${day}`
		: null;
}
