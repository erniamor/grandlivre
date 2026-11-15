import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { NewRecurringPage } from "@/features/recurring/NewRecurringPage";
import { tagsQueryOptions } from "@/features/tags/tags-query";

// The account proposed in the form; anything else is dropped
const searchSchema = z.object({
	account: z.uuid().optional().catch(undefined),
});

export const Route = createFileRoute(
	"/_authenticated/_household/recurring/new",
)({
	validateSearch: searchSchema,
	loader: ({ context }) => {
		const { household, queryClient } = context;
		return Promise.all([
			queryClient.ensureQueryData(accountsQueryOptions(household.id)),
			queryClient.ensureQueryData(tagsQueryOptions(household.id)),
		]);
	},
	component: NewRecurringRoute,
});

function NewRecurringRoute() {
	const { household } = Route.useRouteContext();
	const { account } = Route.useSearch();
	const navigate = useNavigate();

	return (
		<NewRecurringPage
			household={household}
			accountId={account}
			onCreated={() => navigate({ to: "/recurring" })}
		/>
	);
}
