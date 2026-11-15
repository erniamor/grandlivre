import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SuggestedTagsPage } from "@/features/tags/SuggestedTagsPage";
import { suggestedTagsQueryOptions } from "@/features/tags/suggested-tags-query";

export const Route = createFileRoute(
	"/_authenticated/_household/tags/suggested",
)({
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(
			suggestedTagsQueryOptions(context.household.id),
		),
	component: SuggestedTagsRoute,
});

function SuggestedTagsRoute() {
	const { household } = Route.useRouteContext();
	const navigate = useNavigate();

	return (
		<SuggestedTagsPage
			household={household}
			onAdded={() => navigate({ to: "/tags" })}
		/>
	);
}
