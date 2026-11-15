import {
	type InvalidateQueryFilters,
	useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import {
	allHouseholdQueries,
	changesRouteContext,
	householdsQueries,
	staleQueries,
} from "@/features/realtime/stale-queries";
import { getApi } from "@/lib/api";

/**
 * Keeps what the pages show of a household up to date while they are open:
 * listens to its events and reloads what each one makes out of date.
 */
export function useHouseholdEvents(householdId: string): void {
	const queryClient = useQueryClient();
	const router = useRouter();

	// Synchronizes with an external system: the API's stream of events
	useEffect(() => {
		const reload = async (
			filters: InvalidateQueryFilters[],
			routeContext: boolean,
		) => {
			await Promise.all(
				filters.map((filter) => queryClient.invalidateQueries(filter)),
			);
			// The routes read the household from their context: re-run them
			if (routeContext) {
				await router.invalidate();
			}
		};

		return getApi().events.subscribe(householdId, {
			onEvent: ({ topic }) => {
				void reload(
					staleQueries(householdId, topic),
					changesRouteContext(topic),
				);
			},
			// At first and after a reconnection: what changed meanwhile wasn't told
			onReady: () => {
				void reload(allHouseholdQueries(householdId), true);
			},
			onError: ({ closed }) => {
				// Refused for good, e.g. the user was removed from the household:
				// the routes send them where they now belong
				if (closed) {
					void reload(householdsQueries(), true);
				}
			},
		});
	}, [householdId, queryClient, router]);
}
