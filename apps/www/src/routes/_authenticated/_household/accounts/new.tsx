import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { NewAccountPage } from "@/features/accounts/NewAccountPage";
import { householdMembersQueryOptions } from "@/features/households/household-members-query";

export const Route = createFileRoute("/_authenticated/_household/accounts/new")(
	{
		loader: ({ context }) =>
			context.queryClient.ensureQueryData(
				householdMembersQueryOptions(context.household.id),
			),
		component: NewAccountRoute,
	},
);

function NewAccountRoute() {
	const { me, household } = Route.useRouteContext();
	const navigate = useNavigate();

	return (
		<NewAccountPage
			me={me}
			household={household}
			onCreated={() => navigate({ to: "/accounts" })}
		/>
	);
}
