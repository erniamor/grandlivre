import { queryOptions } from "@tanstack/react-query";
import { transactionsQueryKey } from "@/features/transactions/transactions-query";
import { getApi } from "@/lib/api";

/** The most payees shown at once: the API's largest page. */
const PAGE_SIZE = 200;

/**
 * The user's expenses and incomes without a tag, by payee: under the
 * transactions' key, so it follows them.
 */
export function uncategorizedQueryOptions(householdId: string) {
	return queryOptions({
		queryKey: [...transactionsQueryKey(householdId), "uncategorized"] as const,
		queryFn: ({ signal }) =>
			getApi().transactions.uncategorized(householdId, {
				pageSize: PAGE_SIZE,
				signal,
			}),
	});
}
