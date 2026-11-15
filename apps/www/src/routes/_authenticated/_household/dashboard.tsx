import { createFileRoute } from "@tanstack/react-router";
import {
	accountsQueryOptions,
	accountsSummaryQueryOptions,
} from "@/features/accounts/accounts-query";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import {
	pendingQueryOptions,
	upcomingQueryOptions,
} from "@/features/recurring/recurring-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { RECENT_TRANSACTIONS_COUNT } from "@/features/transactions/RecentTransactions";
import { transactionsQueryOptions } from "@/features/transactions/transactions-query";

export const Route = createFileRoute("/_authenticated/_household/dashboard")({
	loader: ({ context }) => {
		const { household, queryClient } = context;
		return Promise.all([
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
		]);
	},
	component: DashboardRoute,
});

function DashboardRoute() {
	const { me, household } = Route.useRouteContext();
	return <DashboardPage me={me} household={household} />;
}
