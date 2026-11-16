import { queryOptions } from "@tanstack/react-query";
import { getApi } from "@/lib/api";

export const importsQueryKey = (householdId: string) =>
	["households", householdId, "imports"] as const;

/** The member's recent imports, the most recent first: those they can undo. */
export function importsQueryOptions(householdId: string) {
	return queryOptions({
		queryKey: importsQueryKey(householdId),
		queryFn: ({ signal }) =>
			getApi().imports.list(householdId, { pageSize: 10, signal }),
	});
}
