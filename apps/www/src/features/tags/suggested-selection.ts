import type { SuggestedTag } from "@repo/schemas";

/** Every key of the suggested tree, in reading order. */
export function suggestedKeys(suggestions: SuggestedTag[]): string[] {
	return suggestions.flatMap(({ key, children }) => [
		key,
		...suggestedKeys(children),
	]);
}

/**
 * Checks or unchecks a suggestion. A key starts with its parent's
 * ("transport/car/gas"), so that:
 * - unchecking a tag unchecks everything under it: it can't be added
 *   without its parent;
 * - checking a tag checks the tags above it, for the same reason, and
 *   everything under it: checking a branch brings it back whole.
 */
export function toggleSuggestion(
	selected: ReadonlySet<string>,
	allKeys: string[],
	key: string,
	checked: boolean,
): Set<string> {
	const isUnder = (other: string) => other.startsWith(`${key}/`);
	if (!checked) {
		return new Set(
			[...selected].filter((other) => other !== key && !isUnder(other)),
		);
	}
	const next = new Set(selected);
	for (const other of allKeys) {
		// Itself, what is under it, and what it is under
		if (other === key || isUnder(other) || key.startsWith(`${other}/`)) {
			next.add(other);
		}
	}
	return next;
}
