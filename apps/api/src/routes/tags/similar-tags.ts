import type { SimilarTagReason, TagNames } from "@repo/schemas";

/** A name reduced to what tells it apart: no case, accents, punctuation or plural. */
export function normalizeTagName(name: string): string {
	return (
		name
			.normalize("NFD")
			.replace(/\p{Diacritic}/gu, "")
			.toLowerCase()
			.replace(/[^\p{L}\p{N}]+/gu, " ")
			.trim()
			.split(" ")
			// "Péages" and "peage": a final s or x on a word of some length is a plural
			.map((word) => (word.length > 3 ? word.replace(/[sx]$/, "") : word))
			.join(" ")
	);
}

/** How many letters to add, remove or change to go from one word to the other. */
function editDistance(a: string, b: string): number {
	let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
	for (let i = 1; i <= a.length; i += 1) {
		const current = [i];
		for (let j = 1; j <= b.length; j += 1) {
			const substitution =
				(previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
			current[j] = Math.min(
				(previous[j] ?? 0) + 1,
				(current[j - 1] ?? 0) + 1,
				substitution,
			);
		}
		previous = current;
	}
	return previous[b.length] ?? 0;
}

/** Why two normalized names look alike, or nothing when they don't. */
function likeness(a: string, b: string): SimilarTagReason | undefined {
	if (a === b) {
		return "same_name";
	}
	const shortest = Math.min(a.length, b.length);
	// Short names differ by little: "car" and "cat" are different tags
	if (shortest >= 4 && editDistance(a, b) <= (shortest <= 6 ? 1 : 2)) {
		return "similar_name";
	}
	const [short, long] = a.length < b.length ? [a, b] : [b, a];
	if (short.length >= 4 && ` ${long} `.includes(` ${short} `)) {
		return "contains";
	}
	return undefined;
}

const rank: Record<SimilarTagReason, number> = {
	same_name: 0,
	similar_name: 1,
	contains: 2,
};

export interface NamedTag {
	id: string;
	names: TagNames;
}

/**
 * The household's tags that look like a proposed one, in any of their
 * languages against any of its names: the closest first.
 */
export function findSimilarTags(
	proposed: string[],
	tags: NamedTag[],
): { tagId: string; reason: SimilarTagReason }[] {
	const wanted = proposed.map(normalizeTagName).filter(Boolean);
	const found: { tagId: string; reason: SimilarTagReason }[] = [];
	for (const tag of tags) {
		let best: SimilarTagReason | undefined;
		for (const name of Object.values(tag.names)) {
			if (!name) {
				continue;
			}
			const normalized = normalizeTagName(name);
			for (const candidate of wanted) {
				const reason = likeness(candidate, normalized);
				if (reason && (best === undefined || rank[reason] < rank[best])) {
					best = reason;
				}
			}
		}
		if (best) {
			found.push({ tagId: tag.id, reason: best });
		}
	}
	return found.sort((a, b) => rank[a.reason] - rank[b.reason]);
}
