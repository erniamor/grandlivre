import { createFileRoute } from "@tanstack/react-router";
import { TagsPage } from "@/features/tags/TagsPage";
import { tagsQueryOptions } from "@/features/tags/tags-query";

export const Route = createFileRoute("/_authenticated/_household/tags/")({
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(tagsQueryOptions(context.household.id)),
	component: TagsRoute,
});

function TagsRoute() {
	const { household } = Route.useRouteContext();
	return <TagsPage household={household} />;
}
