import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { NewTagPage } from "@/features/tags/NewTagPage";
import { tagsQueryOptions } from "@/features/tags/tags-query";

// The tag under which the new one is proposed; anything else is dropped
const searchSchema = z.object({
	parent: z.uuid().optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/_household/tags/new")({
	validateSearch: searchSchema,
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(tagsQueryOptions(context.household.id)),
	component: NewTagRoute,
});

function NewTagRoute() {
	const { household } = Route.useRouteContext();
	const { parent } = Route.useSearch();
	const navigate = useNavigate();

	return (
		<NewTagPage
			household={household}
			parentId={parent}
			onCreated={() => navigate({ to: "/tags" })}
		/>
	);
}
