import { createFileRoute } from "@tanstack/react-router";
import { AccountsPage } from "@/features/accounts/AccountsPage";
import {
	accountsQueryOptions,
	accountsSummaryQueryOptions,
} from "@/features/accounts/accounts-query";

export const Route = createFileRoute("/_authenticated/_household/accounts")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.ensureQueryData(
				accountsQueryOptions(context.household.id),
			),
			context.queryClient.ensureQueryData(
				accountsSummaryQueryOptions(context.household.id),
			),
		]),
	component: AccountsRoute,
});

function AccountsRoute() {
	const { household } = Route.useRouteContext();
	return <AccountsPage household={household} />;
}
