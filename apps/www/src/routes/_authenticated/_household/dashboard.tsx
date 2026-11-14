import { createFileRoute } from "@tanstack/react-router";
import { accountsSummaryQueryOptions } from "@/features/accounts/accounts-query";
import { DashboardPage } from "@/features/dashboard/DashboardPage";

export const Route = createFileRoute("/_authenticated/_household/dashboard")({
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(
			accountsSummaryQueryOptions(context.household.id),
		),
	component: DashboardRoute,
});

function DashboardRoute() {
	const { me, household } = Route.useRouteContext();
	return <DashboardPage me={me} household={household} />;
}
