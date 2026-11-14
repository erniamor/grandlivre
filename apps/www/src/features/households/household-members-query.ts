import { queryOptions } from "@tanstack/react-query";
import { getApi } from "@/lib/api";

// A family fits in one page: the largest the API allows
const PAGE_SIZE = 100;

export const householdMembersQueryKey = (householdId: string) =>
	["households", householdId, "members"] as const;

/** The members of a household, in the order they joined. */
export function householdMembersQueryOptions(householdId: string) {
	return queryOptions({
		queryKey: householdMembersQueryKey(householdId),
		queryFn: ({ signal }) =>
			getApi().households.members.list(householdId, {
				pageSize: PAGE_SIZE,
				signal,
			}),
	});
}
