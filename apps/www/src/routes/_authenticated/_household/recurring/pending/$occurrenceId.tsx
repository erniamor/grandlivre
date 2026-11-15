import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { ConfirmOccurrencePage } from "@/features/recurring/ConfirmOccurrencePage";
import { pendingQueryOptions } from "@/features/recurring/recurring-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";

const occurrenceIdSchema = z.uuid();

export const Route = createFileRoute(
	"/_authenticated/_household/recurring/pending/$occurrenceId",
)({
	loader: async ({ context, params }) => {
		// Not an identifier: no need to ask the API
		if (!occurrenceIdSchema.safeParse(params.occurrenceId).success) {
			throw notFound();
		}
		const { household, queryClient } = context;
		const [pending] = await Promise.all([
			queryClient.ensureQueryData(pendingQueryOptions(household.id)),
			queryClient.ensureQueryData(accountsQueryOptions(household.id)),
			queryClient.ensureQueryData(tagsQueryOptions(household.id)),
		]);
		// Unknown, already handled, or hidden from this user
		if (!pending.items.some((item) => item.id === params.occurrenceId)) {
			throw notFound();
		}
	},
	component: ConfirmOccurrenceRoute,
});

function ConfirmOccurrenceRoute() {
	const { household } = Route.useRouteContext();
	const { occurrenceId } = Route.useParams();
	const navigate = useNavigate();

	return (
		<ConfirmOccurrencePage
			household={household}
			occurrenceId={occurrenceId}
			onDone={() => navigate({ to: "/dashboard" })}
		/>
	);
}
