import { queryOptions } from "@tanstack/react-query";
import { getApi } from "@/lib/api";

export const tagsQueryKey = (householdId: string) =>
	["households", householdId, "tags"] as const;

/** Every tag of the household; their tree is built with `buildTagTree()`. */
export function tagsQueryOptions(householdId: string) {
	return queryOptions({
		queryKey: tagsQueryKey(householdId),
		queryFn: ({ signal }) => getApi().tags.list(householdId, { signal }),
	});
}
