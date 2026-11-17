import { createFileRoute } from "@tanstack/react-router";
import { HouseholdMembersSettings } from "@/features/households/HouseholdMembersSettings";
import { householdInvitationsQueryOptions } from "@/features/households/household-invitations-query";
import { householdMembersQueryOptions } from "@/features/households/household-members-query";
import { useHouseholdChange } from "@/features/households/use-household-change";

export const Route = createFileRoute(
	"/_authenticated/_household/household/members",
)({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.ensureQueryData(
				householdMembersQueryOptions(context.household.id),
			),
			context.queryClient.ensureQueryData(
				householdInvitationsQueryOptions(context.household.id),
			),
		]),
	component: HouseholdMembersRoute,
});

function HouseholdMembersRoute() {
	const { me, household } = Route.useRouteContext();
	const change = useHouseholdChange();

	return (
		<HouseholdMembersSettings
			me={me}
			household={household}
			// Without a household, the dashboard sends the user to /setup
			onMembershipChanged={(left) =>
				change.refresh(left ? "/dashboard" : "/household/members")
			}
		/>
	);
}
