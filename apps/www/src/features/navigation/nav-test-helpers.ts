import type { Household } from "@repo/schemas";
import type { QueryClient } from "@tanstack/react-query";
import type { AnyRouter } from "@tanstack/react-router";
import { act } from "@testing-library/react";
import { householdsQueryKey } from "@/features/households/households-query";

/** Puts `households` in the router's cache, as the household pages would have loaded them. */
export function cacheHouseholds(router: AnyRouter, households: Household[]) {
	const { queryClient } = router.options.context as {
		queryClient: QueryClient;
	};
	act(() => {
		queryClient.setQueryData(householdsQueryKey, {
			items: households,
			page: 1,
			pageSize: 50,
			total: households.length,
		});
	});
}
