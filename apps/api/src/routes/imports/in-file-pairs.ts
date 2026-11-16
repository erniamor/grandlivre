import { dayNumber } from "@/routes/imports/statement-matching";

/** A line of one of the file's accounts, still new, and the account it says it went to. */
export interface PairableLine {
	/** The place of its account in the file. */
	index: number;
	externalId: string;
	date: string;
	amount: number;
	/** The place in the file of the account it went to or came from, if it is there. */
	otherIndex: number | null;
}

/** The days apart the two sides of a transfer may be posted. */
const PAIR_DAYS = 3;

/**
 * The transfers between two accounts of the same file, seen on both: a
 * line of one naming the other, and a line of the other with the opposite
 * amount, close in days; the closest first. Each line in one pair at most.
 * Keyed by "index:externalId", both ways.
 */
export function pairTransfers(
	lines: PairableLine[],
): Map<string, { index: number; externalId: string }> {
	const keyOf = (line: PairableLine) => `${line.index}:${line.externalId}`;
	const candidates: { a: PairableLine; b: PairableLine; distance: number }[] =
		[];
	for (const a of lines) {
		if (a.otherIndex === null || a.otherIndex === a.index) {
			continue;
		}
		for (const b of lines) {
			const distance = Math.abs(dayNumber(a.date) - dayNumber(b.date));
			if (
				b.index === a.otherIndex &&
				b.amount === -a.amount &&
				distance <= PAIR_DAYS &&
				// Either side may name the other; when both do, they agree
				(b.otherIndex === null || b.otherIndex === a.index)
			) {
				candidates.push({ a, b, distance });
			}
		}
	}
	candidates.sort((x, y) => x.distance - y.distance);
	const pairs = new Map<string, { index: number; externalId: string }>();
	for (const { a, b } of candidates) {
		if (!pairs.has(keyOf(a)) && !pairs.has(keyOf(b))) {
			pairs.set(keyOf(a), { index: b.index, externalId: b.externalId });
			pairs.set(keyOf(b), { index: a.index, externalId: a.externalId });
		}
	}
	return pairs;
}
