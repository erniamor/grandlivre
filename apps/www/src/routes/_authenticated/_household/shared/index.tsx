import { createFileRoute, notFound } from "@tanstack/react-router";
import { SharingPage } from "@/features/sharing/SharingPage";
import {
	settlementsQueryOptions,
	sharedExpensesQueryOptions,
	sharingOverviewQueryOptions,
} from "@/features/sharing/sharing-query";

export const Route = createFileRoute("/_authenticated/_household/shared/")({
	beforeLoad: ({ context }) => {
		// Only for the households that settle shared expenses
		if (!context.household.expenseSharing) {
			throw notFound();
		}
	},
	loader: ({ context }) => {
		const { household, queryClient } = context;
		return Promise.all([
			queryClient.ensureQueryData(sharingOverviewQueryOptions(household.id)),
			queryClient.ensureQueryData(sharedExpensesQueryOptions(household.id)),
			queryClient.ensureQueryData(settlementsQueryOptions(household.id)),
		]);
	},
	component: SharingRoute,
});

function SharingRoute() {
	const { household, me } = Route.useRouteContext();

	return <SharingPage household={household} meId={me.id} />;
}
