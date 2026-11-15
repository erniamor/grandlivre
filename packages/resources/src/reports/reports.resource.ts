import {
	type MonthlyReport,
	monthlyReportSchema,
	type TagReport,
	tagReportSchema,
} from "@repo/schemas";
import { segment, withQuery } from "../api/page";
import type { ApiClient } from "../http/client";

/** A period of days, both included: "2026-11-01" to "2026-11-30". */
export interface ReportPeriod {
	from: string;
	to: string;
	/** Only this account: one whose details the user may see. */
	accountId?: string;
	signal?: AbortSignal;
}

const reportsPath = (householdId: string) =>
	`/households/${segment(householdId)}/reports`;

/**
 * What the household earns and spends, from the lines of its expenses and
 * incomes (transfers are neither). Amounts are positive integers in minor
 * units, expenses and incomes apart. Every account counts, those that only
 * show their balance included; narrowing to one of those rejects with a
 * ForbiddenError.
 */
export function createReportsResource(client: ApiClient) {
	return {
		/**
		 * Each tag that had a line in the period, with its own amounts: the
		 * tags under it aren't added. `tagId` is null for the uncategorized lines.
		 */
		async tags(
			householdId: string,
			{ from, to, accountId, signal }: ReportPeriod,
		): Promise<TagReport> {
			return client.request({
				path: withQuery(`${reportsPath(householdId)}/tags`, {
					from,
					to,
					accountId,
				}),
				response: tagReportSchema,
				signal,
			});
		},

		/**
		 * Every month the period touches, in order, empty ones included; with
		 * `tagId`, only the lines on that tag or on a tag under it.
		 */
		async monthly(
			householdId: string,
			{ from, to, accountId, tagId, signal }: ReportPeriod & { tagId?: string },
		): Promise<MonthlyReport> {
			return client.request({
				path: withQuery(`${reportsPath(householdId)}/monthly`, {
					from,
					to,
					tagId,
					accountId,
				}),
				response: monthlyReportSchema,
				signal,
			});
		},
	};
}

export type ReportsResource = ReturnType<typeof createReportsResource>;
