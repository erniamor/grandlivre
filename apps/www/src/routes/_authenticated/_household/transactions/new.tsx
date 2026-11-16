import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { sharingOverviewQueryOptions } from "@/features/sharing/sharing-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { NewTransactionPage } from "@/features/transactions/NewTransactionPage";

// The account proposed in the form, and the draft to review; anything else
// is dropped
const searchSchema = z.object({
	account: z.uuid().optional().catch(undefined),
	draft: z.string().max(40).optional().catch(undefined),
});

export const Route = createFileRoute(
	"/_authenticated/_household/transactions/new",
)({
	validateSearch: searchSchema,
	loader: ({ context }) => {
		const { household, queryClient } = context;
		return Promise.all([
			queryClient.ensureQueryData(accountsQueryOptions(household.id)),
			queryClient.ensureQueryData(tagsQueryOptions(household.id)),
			// The members and the default split, to share it
			household.expenseSharing
				? queryClient.ensureQueryData(sharingOverviewQueryOptions(household.id))
				: undefined,
		]);
	},
	component: NewTransactionRoute,
});

function NewTransactionRoute() {
	const { household } = Route.useRouteContext();
	const { account, draft } = Route.useSearch();
	const navigate = useNavigate();

	return (
		<NewTransactionPage
			household={household}
			accountId={account}
			draftId={draft}
			// Back to the list it was opened from
			onCreated={() => navigate({ to: "/transactions", search: { account } })}
		/>
	);
}
