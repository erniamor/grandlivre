import { NotFoundError } from "@repo/resources";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { EditRecurringPage } from "@/features/recurring/EditRecurringPage";
import { recurringQueryOptions } from "@/features/recurring/recurring-query";
import { sharingOverviewQueryOptions } from "@/features/sharing/sharing-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";

const recurringIdSchema = z.uuid();

export const Route = createFileRoute(
	"/_authenticated/_household/recurring/$recurringId",
)({
	loader: async ({ context, params }) => {
		// Not an identifier: no need to ask the API
		if (!recurringIdSchema.safeParse(params.recurringId).success) {
			throw notFound();
		}
		const { household, queryClient } = context;
		try {
			await Promise.all([
				queryClient.ensureQueryData(
					recurringQueryOptions(household.id, params.recurringId),
				),
				queryClient.ensureQueryData(accountsQueryOptions(household.id)),
				queryClient.ensureQueryData(tagsQueryOptions(household.id)),
				// The members and the default split, to share it
				household.expenseSharing
					? queryClient.ensureQueryData(
							sharingOverviewQueryOptions(household.id),
						)
					: undefined,
			]);
		} catch (error) {
			// Unknown, or on an account that only shows its balance to this user
			if (error instanceof NotFoundError) {
				throw notFound();
			}
			throw error;
		}
	},
	component: EditRecurringRoute,
});

function EditRecurringRoute() {
	const { household } = Route.useRouteContext();
	const { recurringId } = Route.useParams();
	const navigate = useNavigate();

	return (
		<EditRecurringPage
			household={household}
			recurringId={recurringId}
			onDone={() => navigate({ to: "/recurring" })}
		/>
	);
}
