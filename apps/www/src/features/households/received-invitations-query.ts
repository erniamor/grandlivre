import { queryOptions } from "@tanstack/react-query";
import { getApi } from "@/lib/api";

export const receivedInvitationsQueryKey = ["invitations", "received"] as const;

/** The pending invitations to join a household addressed to the signed-in user. */
export function receivedInvitationsQueryOptions() {
	return queryOptions({
		queryKey: receivedInvitationsQueryKey,
		queryFn: ({ signal }) => getApi().invitations.list({ signal }),
	});
}
