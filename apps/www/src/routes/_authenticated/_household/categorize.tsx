import { createFileRoute } from "@tanstack/react-router";
import { CategorizePage } from "@/features/categorize/CategorizePage";
import { uncategorizedQueryOptions } from "@/features/categorize/uncategorized-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { redirectSearchSchema } from "@/lib/redirect";

export const Route = createFileRoute("/_authenticated/_household/categorize")({
	validateSearch: redirectSearchSchema,
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
	const { redirect } = Route.useSearch();

	return (
		<CategorizePage
			household={household}
			fromGettingStarted={redirect === "/getting-started"}
		/>
	);
}
