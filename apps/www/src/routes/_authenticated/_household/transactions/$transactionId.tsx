import { NotFoundError } from "@repo/resources";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { sharingOverviewQueryOptions } from "@/features/sharing/sharing-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { EditTransactionPage } from "@/features/transactions/EditTransactionPage";
import { transactionQueryOptions } from "@/features/transactions/transactions-query";

const transactionIdSchema = z.uuid();

export const Route = createFileRoute(
	"/_authenticated/_household/transactions/$transactionId",
)({
	loader: async ({ context, params }) => {
		// Not an identifier: no need to ask the API
		if (!transactionIdSchema.safeParse(params.transactionId).success) {
			throw notFound();
		}
		const { household, queryClient } = context;
		try {
			await Promise.all([
				queryClient.ensureQueryData(
					transactionQueryOptions(household.id, params.transactionId),
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
	component: EditTransactionRoute,
});

function EditTransactionRoute() {
	const { household } = Route.useRouteContext();
	const { transactionId } = Route.useParams();
	const navigate = useNavigate();

	return (
		<EditTransactionPage
			household={household}
			transactionId={transactionId}
			onDone={() => navigate({ to: "/transactions" })}
		/>
	);
}
