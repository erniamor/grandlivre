import { createFileRoute } from "@tanstack/react-router";
import {
	accountsQueryOptions,
	accountsSummaryQueryOptions,
} from "@/features/accounts/accounts-query";
import { budgetsQueryOptions } from "@/features/budgets/budgets-query";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { monthToDate } from "@/features/dashboard/key-figures";
import {
	pendingQueryOptions,
	upcomingQueryOptions,
} from "@/features/recurring/recurring-query";
import { monthOf } from "@/features/reports/period";
import {
	monthlyReportQueryOptions,
	tagReportQueryOptions,
} from "@/features/reports/reports-query";
import { sharingOverviewQueryOptions } from "@/features/sharing/sharing-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { RECENT_TRANSACTIONS_COUNT } from "@/features/transactions/RecentTransactions";
import { transactionsQueryOptions } from "@/features/transactions/transactions-query";
import { todayIn } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/_household/dashboard")({
	loader: ({ context }) => {
		const { household, queryClient } = context;
		const today = todayIn(household.timeZone);
		// The key figures: this month, against last month at the same day
		const periods = monthToDate(today);
		return Promise.all([
			queryClient.ensureQueryData(
				tagReportQueryOptions(household.id, periods.current),
			),
			queryClient.ensureQueryData(
				tagReportQueryOptions(household.id, periods.previous),
			),
			// The chart of the twelve months ending with this one
			queryClient.ensureQueryData(
				monthlyReportQueryOptions(household.id, monthOf(today)),
			),
			queryClient.ensureQueryData(accountsSummaryQueryOptions(household.id)),
			queryClient.ensureQueryData(
				transactionsQueryOptions(household.id, {
					pageSize: RECENT_TRANSACTIONS_COUNT,
				}),
			),
			queryClient.ensureQueryData(accountsQueryOptions(household.id)),
			queryClient.ensureQueryData(tagsQueryOptions(household.id)),
			queryClient.ensureQueryData(pendingQueryOptions(household.id)),
			queryClient.ensureQueryData(upcomingQueryOptions(household.id)),
			household.expenseSharing
				? queryClient.ensureQueryData(sharingOverviewQueryOptions(household.id))
				: undefined,
			queryClient.ensureQueryData(
				budgetsQueryOptions(household.id, today.slice(0, 7)),
			),
		]);
	},
	component: DashboardRoute,
});

function DashboardRoute() {
	const { me, household } = Route.useRouteContext();
	return <DashboardPage me={me} household={household} />;
}
