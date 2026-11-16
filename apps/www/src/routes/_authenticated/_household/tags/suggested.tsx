import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SuggestedTagsPage } from "@/features/tags/SuggestedTagsPage";
import { suggestedTagsQueryOptions } from "@/features/tags/suggested-tags-query";
import { redirectSearchSchema } from "@/lib/redirect";

export const Route = createFileRoute(
	"/_authenticated/_household/tags/suggested",
)({
	// Where to go once the tags are added: the first steps, say
	validateSearch: redirectSearchSchema,
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(
			suggestedTagsQueryOptions(context.household.id),
		),
	component: SuggestedTagsRoute,
});

function SuggestedTagsRoute() {
	const { household } = Route.useRouteContext();
	const { redirect } = Route.useSearch();
	const navigate = useNavigate();

	return (
		<SuggestedTagsPage
			household={household}
			onAdded={() =>
				redirect ? navigate({ href: redirect }) : navigate({ to: "/tags" })
			}
		/>
	);
}
