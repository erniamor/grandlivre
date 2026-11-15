import type { TransactionFilters } from "@repo/resources";
import { queryOptions } from "@tanstack/react-query";
import { getApi } from "@/lib/api";

export const TRANSACTIONS_PAGE_SIZE = 50;

export const transactionsQueryKey = (householdId: string) =>
	["households", householdId, "transactions"] as const;

interface TransactionsListOptions extends TransactionFilters {
	page?: number;
	pageSize?: number;
}

/** A page of the transactions the signed-in user may see, most recent first. */
export function transactionsQueryOptions(
	householdId: string,
	{
		page = 1,
		pageSize = TRANSACTIONS_PAGE_SIZE,
		...filters
	}: TransactionsListOptions = {},
) {
	return queryOptions({
		queryKey: [
			...transactionsQueryKey(householdId),
			"list",
			{ page, pageSize, ...filters },
		] as const,
		queryFn: ({ signal }) =>
			getApi().transactions.list(householdId, {
				page,
				pageSize,
				signal,
				...filters,
			}),
	});
}
