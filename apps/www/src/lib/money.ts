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
