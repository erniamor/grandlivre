import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/features/dashboard/DashboardPage";

export const Route = createFileRoute("/_authenticated/dashboard")({
	component: DashboardRoute,
});

function DashboardRoute() {
	const { me } = Route.useRouteContext();
	return <DashboardPage me={me} />;
}
