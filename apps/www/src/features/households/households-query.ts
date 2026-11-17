import type { Page } from "@repo/resources";
import type { Household } from "@repo/schemas";
import { queryOptions } from "@tanstack/react-query";
import { getApi } from "@/lib/api";

export const householdsQueryKey = ["households"] as const;

/** A user's households fit in one page: the API's largest. */
const HOUSEHOLDS_PAGE_SIZE = 50;

/** The households the signed-in user belongs to, the oldest first. */
export function householdsQueryOptions() {
	return queryOptions({
		queryKey: householdsQueryKey,
		queryFn: ({ signal }) =>
			getApi().households.list({ pageSize: HOUSEHOLDS_PAGE_SIZE, signal }),
		staleTime: 5 * 60_000,
	});
}

/**
 * The household the app works on: the one the user chose on this device
 * (`preferredId`), while they still belong to it; else their first one;
 * null for a user who has none yet.
 */
export function currentHousehold(
	households: Page<Household>,
	preferredId?: string,
): Household | null {
	return (
		households.items.find((household) => household.id === preferredId) ??
		households.items[0] ??
		null
	);
}
