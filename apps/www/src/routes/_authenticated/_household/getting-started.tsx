import { createFileRoute } from "@tanstack/react-router";
import { GettingStartedPage } from "@/features/getting-started/GettingStartedPage";
import { gettingStartedQueryOptions } from "@/features/getting-started/getting-started-query";

export const Route = createFileRoute(
	"/_authenticated/_household/getting-started",
)({
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(
			gettingStartedQueryOptions(context.household.id),
		),
	component: GettingStartedRoute,
});

function GettingStartedRoute() {
	const { household } = Route.useRouteContext();

	return <GettingStartedPage household={household} />;
}
