import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	currentHousehold,
	householdsQueryOptions,
} from "@/features/households/households-query";
import { receivedInvitationsQueryOptions } from "@/features/households/received-invitations-query";
import { SetupPage } from "@/features/households/SetupPage";
import { useHouseholdChange } from "@/features/households/use-household-change";
import { redirectSearchSchema } from "@/lib/redirect";

const DEFAULT_TARGET = "/dashboard";

export const Route = createFileRoute("/_authenticated/setup")({
	validateSearch: redirectSearchSchema,
	beforeLoad: async ({ context, search }) => {
		const households = await context.queryClient.ensureQueryData(
			householdsQueryOptions(),
		);
		// Already in a household: nothing to do here
		if (currentHousehold(households)) {
			throw redirect({ href: search.redirect ?? DEFAULT_TARGET });
		}
	},
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(receivedInvitationsQueryOptions()),
	component: SetupRoute,
});

function SetupRoute() {
	const target = Route.useSearch().redirect ?? DEFAULT_TARGET;
	const household = useHouseholdChange();

	return <SetupPage onReady={() => household.refresh(target)} />;
}
