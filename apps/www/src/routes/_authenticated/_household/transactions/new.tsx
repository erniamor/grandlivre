import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { NewTransactionPage } from "@/features/transactions/NewTransactionPage";

// The account proposed in the form; anything else is dropped
const searchSchema = z.object({
	account: z.uuid().optional().catch(undefined),
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
		]);
	},
	component: NewTransactionRoute,
});

function NewTransactionRoute() {
	const { household } = Route.useRouteContext();
	const { account } = Route.useSearch();
	const navigate = useNavigate();

	return (
		<NewTransactionPage
			household={household}
			accountId={account}
			// Back to the list it was opened from
			onCreated={() => navigate({ to: "/transactions", search: { account } })}
		/>
	);
}
