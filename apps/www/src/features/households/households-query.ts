import type { Page } from "@repo/resources";
import type { Household } from "@repo/schemas";
import { queryOptions } from "@tanstack/react-query";
import { getApi } from "@/lib/api";

export const householdsQueryKey = ["households"] as const;

/** The households the signed-in user belongs to. */
export function householdsQueryOptions() {
	return queryOptions({
		queryKey: householdsQueryKey,
		queryFn: ({ signal }) => getApi().households.list({ signal }),
		staleTime: 5 * 60_000,
	});
}

/**
 * The household the app works on, or null for a user who has none yet. A user
 * can belong to several households, but the interface handles a single one
 * for now: the first they joined.
 */
export function currentHousehold(
	households: Page<Household>,
): Household | null {
	return households.items[0] ?? null;
}
