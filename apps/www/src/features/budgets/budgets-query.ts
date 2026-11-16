import { queryOptions } from "@tanstack/react-query";
import { getApi } from "@/lib/api";

/** Every query of a household's budgets starts with this key. */
export const budgetsQueryKey = (householdId: string) =>
	["households", householdId, "budgets"] as const;

/** The budgets in force in a month ("2026-11"), and where they stand. */
export function budgetsQueryOptions(householdId: string, month: string) {
	return queryOptions({
		queryKey: [...budgetsQueryKey(householdId), "month", month] as const,
		queryFn: ({ signal }) =>
			getApi().budgets.list(householdId, { month, signal }),
	});
}

/** What a tag usually costs before a month, to suggest a budget. */
export function budgetSuggestionQueryOptions(
	householdId: string,
	tagId: string,
	month: string,
) {
	return queryOptions({
		queryKey: [
			...budgetsQueryKey(householdId),
			"suggestion",
			tagId,
			month,
		] as const,
		queryFn: ({ signal }) =>
			getApi().budgets.suggestion(householdId, tagId, { month, signal }),
	});
}
