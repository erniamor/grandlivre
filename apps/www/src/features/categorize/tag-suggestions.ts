import {
	type PayeeTagSuggestions,
	TAG_SUGGESTION_MAX_PAYEES,
	type UncategorizedPayee,
} from "@repo/schemas";

/** A payee group's id: its type and its key. */
export function groupId({
	type,
	key,
}: Pick<UncategorizedPayee, "type" | "key">): string {
	return `${type}:${key}`;
}

/**
 * The assistant's answers by payee group: a tag, or null when it had
 * none; a group missing wasn't asked yet.
 */
export type SuggestionMap = ReadonlyMap<string, string | null>;

/** The tags the user chose by hand, by payee group. */
export type ChoiceMap = ReadonlyMap<string, string>;

/** The next payees to ask the assistant about: those not asked yet, in order, a request's worth. */
export function nextToAsk(
	groups: UncategorizedPayee[],
	suggestions: SuggestionMap,
): UncategorizedPayee[] {
	return groups
		.filter((group) => !suggestions.has(groupId(group)))
		.slice(0, TAG_SUGGESTION_MAX_PAYEES);
}

/** The assistant's answers added to those before, a payee left out of its answer counted as asked. */
export function withSuggestions(
	suggestions: SuggestionMap,
	asked: UncategorizedPayee[],
	answer: PayeeTagSuggestions,
): SuggestionMap {
	const next = new Map(suggestions);
	for (const group of asked) {
		next.set(groupId(group), null);
	}
	for (const suggestion of answer.suggestions) {
		next.set(groupId(suggestion), suggestion.tagId);
	}
	return next;
}

/**
 * The tag a payee's select shows: the user's choice, else the assistant's
 * when it is still one of the household's.
 */
export function shownTag(
	group: UncategorizedPayee,
	choices: ChoiceMap,
	suggestions: SuggestionMap,
	tagIds: ReadonlySet<string>,
): { tagId: string; suggested: boolean } {
	const id = groupId(group);
	const choice = choices.get(id);
	if (choice !== undefined) {
		return { tagId: choice, suggested: false };
	}
	const suggestion = suggestions.get(id);
	return suggestion && tagIds.has(suggestion)
		? { tagId: suggestion, suggested: true }
		: { tagId: "", suggested: false };
}

/** What "Apply" sets for every payee: those a tag shows for, the assistant's or the user's. */
export function tagsToApply(
	groups: UncategorizedPayee[],
	choices: ChoiceMap,
	suggestions: SuggestionMap,
	tagIds: ReadonlySet<string>,
): { group: UncategorizedPayee; tagId: string }[] {
	return groups.flatMap((group) => {
		const { tagId } = shownTag(group, choices, suggestions, tagIds);
		return tagId ? [{ group, tagId }] : [];
	});
}
