import { useQueryClient } from "@tanstack/react-query";
import { recurringQueryKey } from "@/features/recurring/recurring-query";

/** Reloads the household's recurring transactions after a change. */
export function useRecurringChange(householdId: string) {
	const queryClient = useQueryClient();

	return () =>
		queryClient.invalidateQueries({ queryKey: recurringQueryKey(householdId) });
}
