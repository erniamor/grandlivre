import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { householdsQueryOptions } from "@/features/households/households-query";
import { receivedInvitationsQueryOptions } from "@/features/households/received-invitations-query";
import { SetupPage } from "@/features/households/SetupPage";
import { useHouseholdChange } from "@/features/households/use-household-change";
import { redirectSearchSchema } from "@/lib/redirect";

const DEFAULT_TARGET = "/dashboard";
/** Where a household just made starts: its first steps. */
const NEW_HOUSEHOLD_TARGET = "/getting-started";

export const Route = createFileRoute("/_authenticated/setup")({
	validateSearch: redirectSearchSchema,
	// A user in a household comes here to create or join another one
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.ensureQueryData(householdsQueryOptions()),
			context.queryClient.ensureQueryData(receivedInvitationsQueryOptions()),
		]),
	component: SetupRoute,
});

function SetupRoute() {
	const { redirect: target } = Route.useSearch();
	const household = useHouseholdChange();
	const { data: households } = useSuspenseQuery(householdsQueryOptions());

	return (
		<SetupPage
			another={households.items.length > 0}
			onReady={(created, how) =>
				household.refresh(
					target ?? (how === "created" ? NEW_HOUSEHOLD_TARGET : DEFAULT_TARGET),
					created.id,
				)
			}
		/>
	);
}
