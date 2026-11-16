import { useQueryClient } from "@tanstack/react-query";
import { budgetsQueryKey } from "@/features/budgets/budgets-query";

/** Reloads the household's budgets after a change. */
export function useBudgetsChange(householdId: string) {
	const queryClient = useQueryClient();

	return () =>
		queryClient.invalidateQueries({ queryKey: budgetsQueryKey(householdId) });
}
