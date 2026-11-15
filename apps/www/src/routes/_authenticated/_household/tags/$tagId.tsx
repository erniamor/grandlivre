import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { EditTagPage } from "@/features/tags/EditTagPage";
import { tagsQueryOptions } from "@/features/tags/tags-query";

export const Route = createFileRoute("/_authenticated/_household/tags/$tagId")({
	loader: async ({ context, params }) => {
		const tags = await context.queryClient.ensureQueryData(
			tagsQueryOptions(context.household.id),
		);
		if (!tags.some((tag) => tag.id === params.tagId)) {
			throw notFound();
		}
	},
	component: EditTagRoute,
});

function EditTagRoute() {
	const { household } = Route.useRouteContext();
	const { tagId } = Route.useParams();
	const navigate = useNavigate();

	return (
		<EditTagPage
			household={household}
			tagId={tagId}
			onDone={() => navigate({ to: "/tags" })}
		/>
	);
}
