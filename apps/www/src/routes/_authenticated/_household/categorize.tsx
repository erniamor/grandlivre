import { createFileRoute } from "@tanstack/react-router";
import { CategorizePage } from "@/features/categorize/CategorizePage";
import { uncategorizedQueryOptions } from "@/features/categorize/uncategorized-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";

export const Route = createFileRoute("/_authenticated/_household/categorize")({
	loader: async ({ context }) => {
		const { household, queryClient } = context;
		await Promise.all([
			queryClient.ensureQueryData(uncategorizedQueryOptions(household.id)),
			queryClient.ensureQueryData(tagsQueryOptions(household.id)),
		]);
	},
	component: CategorizeRoute,
});

function CategorizeRoute() {
	const { household } = Route.useRouteContext();

	return <CategorizePage household={household} />;
}
