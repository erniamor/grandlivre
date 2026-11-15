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

/**
 * Reads an amount as printed on a receipt ("12.99", "-2.00" for a
 * discount, "0.00") into minor units, or null when it isn't one.
 */
export function parsePrintedAmount(
	text: string,
	currency: string,
): number | null {
	const trimmed = text.trim();
	const negative = trimmed.startsWith("-");
	const digits = negative ? trimmed.slice(1) : trimmed;
	if (/^0+(?:[.,]0+)?$/.test(digits.trim())) {
		return 0;
	}
	const amount = parseDraftAmount(digits, currency);
	if (amount === null) {
		return null;
	}
	return negative ? -amount : amount;
}
