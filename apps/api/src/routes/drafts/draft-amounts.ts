/** Number of decimals of a currency's minor unit: 2 for CAD, 0 for JPY. */
function minorUnitDigits(currency: string): number {
	return (
		new Intl.NumberFormat("en", {
			style: "currency",
			currency,
		}).resolvedOptions().maximumFractionDigits ?? 2
	);
}

/**
 * Reads an amount the assistant wrote ("72.40", "72", "72,40") into minor
 * units, or null when it isn't a positive amount the currency can hold.
 */
export function parseDraftAmount(
	text: string,
	currency: string,
): number | null {
	const match = /^\s*(\d+)(?:[.,](\d+))?\s*$/.exec(text);
	if (!match) {
		return null;
	}
	const [, whole = "", decimals = ""] = match;
	const digits = minorUnitDigits(currency);
	if (decimals.length > digits) {
		return null;
	}
	const amount = Number(`${whole}${decimals.padEnd(digits, "0")}`);
	return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}
