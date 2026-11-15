import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import {
	currentHousehold,
	householdsQueryOptions,
} from "@/features/households/households-query";
import { useHouseholdEvents } from "@/features/realtime/use-household-events";

// Layout of the pages that work on a household (`_household/*`): a user who
// has none yet creates or joins one first, then is brought back. While these
// pages are open, what they show follows the changes made by the members.
export const Route = createFileRoute("/_authenticated/_household")({
	beforeLoad: async ({ context, location }) => {
		const household = currentHousehold(
			await context.queryClient.ensureQueryData(householdsQueryOptions()),
		);
		if (!household) {
			throw redirect({ to: "/setup", search: { redirect: location.href } });
		}
		return { household };
	},
	component: HouseholdLayout,
});

function HouseholdLayout() {
	const { household } = Route.useRouteContext();
	useHouseholdEvents(household.id);
	return <Outlet />;
}
