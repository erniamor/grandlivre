import { NotFoundError } from "@repo/resources";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { NewRecurringPage } from "@/features/recurring/NewRecurringPage";
import { suggestionsQueryOptions } from "@/features/recurring/recurring-query";
import { findSuggestion } from "@/features/recurring/recurring-suggestion";
import { sharingOverviewQueryOptions } from "@/features/sharing/sharing-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { transactionQueryOptions } from "@/features/transactions/transactions-query";

// The account proposed in the form, and the transaction or the series found
// in the history it starts from; anything else is dropped
const searchSchema = z.object({
	account: z.uuid().optional().catch(undefined),
	from: z.uuid().optional().catch(undefined),
	suggestion: z.string().max(400).optional().catch(undefined),
});

export const Route = createFileRoute(
	"/_authenticated/_household/recurring/new",
)({
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => ({
		from: search.from,
		suggestion: search.suggestion,
	}),
	loader: ({ context, deps }) => {
		const { household, queryClient } = context;
		return Promise.all([
			queryClient.ensureQueryData(accountsQueryOptions(household.id)),
			queryClient.ensureQueryData(tagsQueryOptions(household.id)),
			// The members and the default split, to share it
			household.expenseSharing
				? queryClient.ensureQueryData(sharingOverviewQueryOptions(household.id))
				: undefined,
			deps.from
				? queryClient
						.ensureQueryData(transactionQueryOptions(household.id, deps.from))
						// One the user may not see: the form starts blank
						.catch((error: unknown) => {
							if (!(error instanceof NotFoundError)) {
								throw error;
							}
						})
				: undefined,
			deps.suggestion
				? queryClient.ensureQueryData(suggestionsQueryOptions(household.id))
				: undefined,
		]);
	},
	component: NewRecurringRoute,
});

function NewRecurringRoute() {
	const { household } = Route.useRouteContext();
	const { account, from, suggestion } = Route.useSearch();
	const navigate = useNavigate();
	// Loaded by the loader when there is one: read from the cache
	const { data: transaction } = useQuery({
		...transactionQueryOptions(household.id, from ?? ""),
		enabled: false,
	});

	// Loaded by the loader when asked: one no longer offered starts it blank
	const { data: suggestions } = useQuery({
		...suggestionsQueryOptions(household.id),
		enabled: false,
	});

	return (
		<NewRecurringPage
			household={household}
			accountId={account}
			from={from ? transaction : undefined}
			suggestion={
				suggestion && suggestions
					? findSuggestion(suggestions.items, suggestion)
					: undefined
			}
			onCreated={() => navigate({ to: "/recurring" })}
		/>
	);
}
