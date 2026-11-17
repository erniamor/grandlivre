import { createFileRoute } from "@tanstack/react-router";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { RecurringPage } from "@/features/recurring/RecurringPage";
import {
	recurringListQueryOptions,
	suggestionsQueryOptions,
} from "@/features/recurring/recurring-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";

export const Route = createFileRoute("/_authenticated/_household/recurring/")({
	loader: ({ context }) => {
		const { household, queryClient } = context;
		return Promise.all([
			queryClient.ensureQueryData(recurringListQueryOptions(household.id)),
			queryClient.ensureQueryData(accountsQueryOptions(household.id)),
			queryClient.ensureQueryData(tagsQueryOptions(household.id)),
			queryClient.ensureQueryData(suggestionsQueryOptions(household.id)),
		]);
	},
	component: RecurringRoute,
});

function RecurringRoute() {
	const { household } = Route.useRouteContext();

	return <RecurringPage household={household} />;
}
