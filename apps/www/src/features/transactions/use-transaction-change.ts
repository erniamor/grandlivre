import { useQueryClient } from "@tanstack/react-query";
import { accountsQueryKey } from "@/features/accounts/accounts-query";
import { transactionsQueryKey } from "@/features/transactions/transactions-query";

/**
 * After a transaction is recorded, changed or deleted: refreshes the lists
 * of transactions, and the accounts, whose balances follow.
 */
export function useTransactionChange(householdId: string) {
	const queryClient = useQueryClient();

	return () =>
		Promise.all([
			queryClient.invalidateQueries({
				queryKey: transactionsQueryKey(householdId),
			}),
			queryClient.invalidateQueries({
				queryKey: accountsQueryKey(householdId),
			}),
		]);
}
