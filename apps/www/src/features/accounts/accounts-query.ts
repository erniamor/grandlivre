import { queryOptions } from "@tanstack/react-query";
import { getApi } from "@/lib/api";

// A family's accounts fit in one page: the largest the API allows
const PAGE_SIZE = 100;

export const accountsQueryKey = (householdId: string) =>
	["households", householdId, "accounts"] as const;

/** Every account of the household, as the signed-in user may see it. */
export function accountsQueryOptions(householdId: string) {
	return queryOptions({
		queryKey: [...accountsQueryKey(householdId), "list"] as const,
		queryFn: ({ signal }) =>
			getApi().accounts.list(householdId, { pageSize: PAGE_SIZE, signal }),
	});
}

/** The household's consolidated view: assets, liabilities, net balance. */
export function accountsSummaryQueryOptions(householdId: string) {
	return queryOptions({
		queryKey: [...accountsQueryKey(householdId), "summary"] as const,
		queryFn: ({ signal }) => getApi().accounts.summary(householdId, { signal }),
	});
}
