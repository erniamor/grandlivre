import { minorUnitDigits } from "@/lib/money";

/**
 * The amount slider's stops, in major units (dollars): close together for
 * small amounts, far apart for large ones. One more stop past the last one
 * stands for "no maximum".
 */
export const AMOUNT_STOPS = [0, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

/** The slider's last position: no maximum. */
export const NO_MAXIMUM = AMOUNT_STOPS.length;

export interface AmountRange {
	/** In minor units; undefined: no minimum. */
	minAmount?: number;
	/** In minor units; undefined: no maximum. */
	maxAmount?: number;
}

/** A stop's amount, in minor units of `currency`. */
export function stopAmount(stop: number, currency: string): number {
	return (AMOUNT_STOPS[stop] ?? 0) * 10 ** minorUnitDigits(currency);
}

/**
 * Where the slider's two thumbs stand for a range: an amount between two
 * stops (typed in the address) widens the range to them.
 */
export function rangeToStops(
	{ minAmount, maxAmount }: AmountRange,
	currency: string,
): [number, number] {
	let low = 0;
	if (minAmount !== undefined) {
		while (low + 1 < NO_MAXIMUM && stopAmount(low + 1, currency) <= minAmount) {
			low += 1;
		}
	}
	let high = NO_MAXIMUM;
	if (maxAmount !== undefined) {
		const found = AMOUNT_STOPS.findIndex(
			(_, stop) => stopAmount(stop, currency) >= maxAmount,
		);
		high = found === -1 ? NO_MAXIMUM : found;
	}
	return [low, Math.max(low, high)];
}

/** The range the slider's thumbs stand for: its ends left open at the ends. */
export function stopsToRange(
	[low, high]: [number, number],
	currency: string,
): AmountRange {
	return {
		minAmount: low === 0 ? undefined : stopAmount(low, currency),
		maxAmount: high >= NO_MAXIMUM ? undefined : stopAmount(high, currency),
	};
}
