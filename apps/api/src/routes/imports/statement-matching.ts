/**
 * How many days a statement line may come before (negative) or after the
 * transaction it is: a bank posts a purchase a day or a few later, seldom
 * earlier (a member noting a payment ahead of its day).
 */
export const MATCH_DAYS_BEFORE = 3;
export const MATCH_DAYS_AFTER = 5;

/** A day as a number of days, to count the days between two. */
export function dayNumber(date: string): number {
	return Date.parse(`${date}T00:00:00Z`) / 86_400_000;
}

/** A day moved by `days`, as YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
	return new Date((dayNumber(date) + days) * 86_400_000)
		.toISOString()
		.slice(0, 10);
}

/** Something already in the account a line could be: a transaction, or a day waiting. */
export interface MatchCandidate<Ref> {
	ref: Ref;
	date: string;
	/** As seen from the account: positive in, negative out. */
	amount: number;
	/** A transaction goes before a recurring day at the same distance. */
	rank: number;
}

/**
 * Each line tied to at most one candidate, and each candidate to at most
 * one line: the same amount, a day close enough, the closest first (then
 * the line first in the statement, then the candidate's rank).
 */
export function matchLines<Ref>(
	lines: { date: string; amount: number }[],
	candidates: MatchCandidate<Ref>[],
	/** Whether a line may be this candidate at all, beyond amount and day. */
	accepts: (line: number, candidate: Ref) => boolean = () => true,
): Map<number, Ref> {
	const pairs: { line: number; candidate: number; distance: number }[] = [];
	for (const [lineAt, line] of lines.entries()) {
		for (const [candidateAt, candidate] of candidates.entries()) {
			const late = dayNumber(line.date) - dayNumber(candidate.date);
			if (
				candidate.amount === line.amount &&
				accepts(lineAt, candidate.ref) &&
				late >= -MATCH_DAYS_BEFORE &&
				late <= MATCH_DAYS_AFTER
			) {
				pairs.push({
					line: lineAt,
					candidate: candidateAt,
					distance: Math.abs(late),
				});
			}
		}
	}
	pairs.sort(
		(a, b) =>
			a.distance - b.distance ||
			a.line - b.line ||
			(candidates[a.candidate]?.rank ?? 0) -
				(candidates[b.candidate]?.rank ?? 0),
	);
	const matched = new Map<number, Ref>();
	const taken = new Set<number>();
	for (const pair of pairs) {
		const candidate = candidates[pair.candidate];
		if (candidate && !matched.has(pair.line) && !taken.has(pair.candidate)) {
			matched.set(pair.line, candidate.ref);
			taken.add(pair.candidate);
		}
	}
	return matched;
}
