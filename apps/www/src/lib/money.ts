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
 * Formats an amount in minor units (cents) for display: 125050 in CAD is
 * "$1,250.50" in English and "1 250,50 $" in French. The symbol is the short
 * one: a household works in a single currency.
 */
export function formatAmount(
	amount: number,
	currency: string,
	locale: string,
): string {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
		currencyDisplay: "narrowSymbol",
	}).format(amount / 10 ** minorUnitDigits(currency));
}

/**
 * Formats an amount in minor units as the text of an input, the way
 * `parseAmount()` reads it back: 125050 is "1250.50" in English and
 * "1250,50" in French.
 */
export function formatAmountInput(
	amount: number,
	currency: string,
	locale: string,
): string {
	const digits = minorUnitDigits(currency);
	return new Intl.NumberFormat(locale, {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
		useGrouping: false,
	}).format(amount / 10 ** digits);
}

/** The character that separates decimals in `locale`: "." or ",". */
function decimalSeparator(locale: string): string {
	return (
		new Intl.NumberFormat(locale)
			.formatToParts(1.5)
			.find((part) => part.type === "decimal")?.value ?? "."
	);
}

/**
 * Where the decimals start in digits written with "." and ",": the index of
 * the decimal separator, or -1 when every separator groups thousands.
 */
function decimalIndex(digits: string, locale: string): number {
	const lastDot = digits.lastIndexOf(".");
	const lastComma = digits.lastIndexOf(",");
	if (lastDot === -1 && lastComma === -1) {
		return -1;
	}
	// Both kinds: the last one separates the decimals ("1,234.56", "1.234,56")
	if (lastDot !== -1 && lastComma !== -1) {
		return Math.max(lastDot, lastComma);
	}
	const index = Math.max(lastDot, lastComma);
	const separator = digits.charAt(index);
	// Repeated: it groups thousands ("1,234,567")
	if (digits.indexOf(separator) !== index) {
		return -1;
	}
	// Followed by three digits, it could be either ("1,234"): the language decides.
	// Anything else can only be decimals ("12,5", "12.50").
	if (digits.length - index - 1 === 3) {
		return separator === decimalSeparator(locale) ? index : -1;
	}
	return index;
}

/**
 * Reads an amount typed by the user into minor units (cents), or null when
 * it isn't one. Accepts the language's format and the common variants:
 * "1 234,56", "1,234.56", "1234.5", "-45", "72 $".
 */
export function parseAmount(
	text: string,
	currency: string,
	locale: string,
): number | null {
	// Spaces (plain or not) group thousands; the currency's symbol is ignored
	const compact = text
		.replace(/[\s'’]/g, "")
		.replace(/−/g, "-")
		.replace(/[^\d.,-]/g, "");
	const negative = compact.startsWith("-");
	const digits = negative ? compact.slice(1) : compact;
	if (!/^[\d.,]*\d[\d.,]*$/.test(digits)) {
		return null;
	}

	const index = decimalIndex(digits, locale);
	const grouped = index === -1 ? digits : digits.slice(0, index);
	// Plain digits, or thousands grouped by one and the same separator
	if (!/^(?:\d*|\d{1,3}([.,])\d{3}(?:\1\d{3})*)$/.test(grouped)) {
		return null;
	}
	const whole = grouped.replace(/[.,]/g, "");
	const decimals = index === -1 ? "" : digits.slice(index + 1);
	const minorDigits = minorUnitDigits(currency);
	// More decimals than the currency has: not an amount ("12.345" in CAD)
	if (decimals.length > minorDigits) {
		return null;
	}

	const amount = Number(`${whole || "0"}${decimals.padEnd(minorDigits, "0")}`);
	if (!Number.isSafeInteger(amount)) {
		return null;
	}
	return negative && amount !== 0 ? -amount : amount;
}
