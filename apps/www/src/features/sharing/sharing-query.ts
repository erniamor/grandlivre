import type { Household } from "@repo/schemas";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { getApi } from "@/lib/api";

/** Every query of a household's sharing starts with this key. */
export const sharingQueryKey = (householdId: string) =>
	["households", householdId, "sharing"] as const;

/** Balances, default split, and the payments that settle everything. */
export function sharingOverviewQueryOptions(householdId: string) {
	return queryOptions({
		queryKey: [...sharingQueryKey(householdId), "overview"] as const,
		queryFn: ({ signal }) => getApi().sharing.overview(householdId, { signal }),
	});
}

/** The history shows the last ones: one page. */
export const SHARING_HISTORY_SIZE = 50;

export function sharedExpensesQueryOptions(householdId: string) {
	return queryOptions({
		queryKey: [...sharingQueryKey(householdId), "expenses"] as const,
		queryFn: ({ signal }) =>
			getApi().sharing.expenses(householdId, {
				pageSize: SHARING_HISTORY_SIZE,
				signal,
			}),
	});
}

export function settlementsQueryOptions(householdId: string) {
	return queryOptions({
		queryKey: [...sharingQueryKey(householdId), "settlements"] as const,
		queryFn: ({ signal }) =>
			getApi().sharing.settlements(householdId, {
				pageSize: SHARING_HISTORY_SIZE,
				signal,
			}),
	});
}

/** What the transaction form needs to share: the members and the default split. */
export interface SharingContext {
	members: { userId: string; name: string }[];
	weights: { userId: string; weight: number }[];
}

/**
 * The sharing context of a household that settles shared expenses, from
 * the cache its route loaded; undefined for one that doesn't.
 */
export function useSharingContext(
	household: Household,
): SharingContext | undefined {
	const { data } = useQuery({
		...sharingOverviewQueryOptions(household.id),
		enabled: household.expenseSharing,
	});
	if (!household.expenseSharing || !data) {
		return undefined;
	}
	return {
		members: data.balances
			.filter((balance) => balance.isMember)
			.map(({ userId, name }) => ({ userId, name })),
		weights: data.weights,
	};
}
