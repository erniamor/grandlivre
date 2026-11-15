import { queryOptions } from "@tanstack/react-query";
import type { Period } from "@/features/reports/period";
import { getApi } from "@/lib/api";

export const reportsQueryKey = (householdId: string) =>
	["households", householdId, "reports"] as const;

/** What each tag gathered over a period, every account of the household counted. */
export function tagReportQueryOptions(
	householdId: string,
	{ from, to }: Period,
) {
	return queryOptions({
		queryKey: [...reportsQueryKey(householdId), "tags", from, to] as const,
		queryFn: ({ signal }) =>
			getApi().reports.tags(householdId, { from, to, signal }),
	});
}
