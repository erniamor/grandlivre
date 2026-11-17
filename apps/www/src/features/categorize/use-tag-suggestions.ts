import type { UncategorizedPayee } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
	groupId,
	nextToAsk,
	type SuggestionMap,
	withSuggestions,
} from "@/features/categorize/tag-suggestions";
import { getApi } from "@/lib/api";
import { actionErrorMessage } from "@/lib/error-messages";

/**
 * The assistant's tags for the payees shown, asked a request's worth at a
 * time; kept while the page is open, never applied by themselves.
 */
export function useTagSuggestions(
	householdId: string,
	groups: UncategorizedPayee[],
) {
	const [suggestions, setSuggestions] = useState<SuggestionMap>(new Map());
	const suggest = useMutation({
		mutationFn: async () => {
			const asked = nextToAsk(groups, suggestions);
			const answer = await getApi().transactions.suggestTags(householdId, {
				payees: asked.map(({ key, type }) => ({ key, type })),
			});
			return { asked, answer };
		},
		onSuccess: ({ asked, answer }) => {
			setSuggestions((before) => withSuggestions(before, asked, answer));
		},
		onError: (error) => {
			toast.error(actionErrorMessage(error));
		},
	});
	const askedCount = groups.filter((group) =>
		suggestions.has(groupId(group)),
	).length;

	return {
		suggestions,
		/** How many payees shown were not asked yet. */
		remaining: groups.length - askedCount,
		askedCount,
		suggest: () => suggest.mutate(),
		pending: suggest.isPending,
	};
}
