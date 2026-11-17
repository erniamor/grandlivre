import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { householdsQueryOptions } from "@/features/households/households-query";
import { rememberHousehold } from "@/features/households/preferred-household";
import { receivedInvitationsQueryKey } from "@/features/households/received-invitations-query";

/**
 * After creating, joining or leaving a household: works on the one made or
 * joined from now on, on this device; reloads the user's households, re-runs the routes' checks
 * (redirects, route context) and opens `href`.
 */
export function useHouseholdChange() {
	const queryClient = useQueryClient();
	const router = useRouter();

	return {
		/** `householdId`: the household made or joined, to work on from now on. */
		async refresh(href: string, householdId?: string) {
			if (householdId) {
				rememberHousehold(householdId);
			}
			await Promise.all([
				queryClient.fetchQuery({
					...householdsQueryOptions(),
					staleTime: 0,
				}),
				// An invitation accepted is no longer pending
				queryClient.invalidateQueries({
					queryKey: receivedInvitationsQueryKey,
				}),
			]);
			await router.invalidate();
			await router.navigate({ href });
		},
	};
}
