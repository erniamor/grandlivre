import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/features/dashboard/DashboardPage";

export const Route = createFileRoute("/_authenticated/_household/dashboard")({
	component: DashboardRoute,
});

function DashboardRoute() {
	const { me, household } = Route.useRouteContext();
	return <DashboardPage me={me} household={household} />;
}
