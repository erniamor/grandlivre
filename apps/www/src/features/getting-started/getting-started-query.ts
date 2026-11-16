import { queryOptions } from "@tanstack/react-query";
import { getApi } from "@/lib/api";

export const gettingStartedQueryKey = (householdId: string) =>
	["households", householdId, "getting-started"] as const;

/** Where the household stands in its first steps, as the user sees it. */
export function gettingStartedQueryOptions(householdId: string) {
	return queryOptions({
		queryKey: gettingStartedQueryKey(householdId),
		queryFn: ({ signal }) =>
			getApi().households.gettingStarted(householdId, { signal }),
	});
}
