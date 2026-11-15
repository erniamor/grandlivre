import { queryOptions } from "@tanstack/react-query";
import { getApi } from "@/lib/api";

/** Every query of a household's recurring transactions starts with this key. */
export const recurringQueryKey = (householdId: string) =>
	["households", householdId, "recurring"] as const;

/** The recurring transactions are few: one page holds them all. */
const RECURRING_PAGE_SIZE = 100;

/** The recurring transactions the signed-in user may see, the next due first. */
export function recurringListQueryOptions(householdId: string) {
	return queryOptions({
		queryKey: [...recurringQueryKey(householdId), "list"] as const,
		queryFn: ({ signal }) =>
			getApi().recurring.list(householdId, {
				pageSize: RECURRING_PAGE_SIZE,
				signal,
			}),
	});
}

export function recurringQueryOptions(
	householdId: string,
	recurringId: string,
) {
	return queryOptions({
		queryKey: [
			...recurringQueryKey(householdId),
			"detail",
			recurringId,
		] as const,
		queryFn: ({ signal }) =>
			getApi().recurring.get(householdId, recurringId, { signal }),
	});
}
