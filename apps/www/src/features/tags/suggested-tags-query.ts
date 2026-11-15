import { queryOptions } from "@tanstack/react-query";
import { getApi } from "@/lib/api";

/** The tags the product suggests to a household starting out, as a tree. */
export function suggestedTagsQueryOptions(householdId: string) {
	return queryOptions({
		// Not under the household's tags: adding tags doesn't change the suggestions
		queryKey: ["households", householdId, "suggested-tags"] as const,
		queryFn: ({ signal }) => getApi().tags.suggested(householdId, { signal }),
		// The same for everyone, until the app is updated
		staleTime: Number.POSITIVE_INFINITY,
	});
}
