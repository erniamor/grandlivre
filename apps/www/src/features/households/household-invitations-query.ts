import { queryOptions } from "@tanstack/react-query";
import { getApi } from "@/lib/api";

// Pending invitations fit in one page: the largest the API allows
const PAGE_SIZE = 50;

export const householdInvitationsQueryKey = (householdId: string) =>
	["households", householdId, "invitations"] as const;

/** The pending invitations sent by a household. */
export function householdInvitationsQueryOptions(householdId: string) {
	return queryOptions({
		queryKey: householdInvitationsQueryKey(householdId),
		queryFn: ({ signal }) =>
			getApi().households.invitations.list(householdId, {
				pageSize: PAGE_SIZE,
				signal,
			}),
	});
}
