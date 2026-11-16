import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { NewAccountPage } from "@/features/accounts/NewAccountPage";
import { householdMembersQueryOptions } from "@/features/households/household-members-query";
import { redirectSearchSchema } from "@/lib/redirect";

export const Route = createFileRoute("/_authenticated/_household/accounts/new")(
	{
		// Where to go once the account is made: the first steps, say
		validateSearch: redirectSearchSchema,
		loader: ({ context }) =>
			context.queryClient.ensureQueryData(
				householdMembersQueryOptions(context.household.id),
			),
		component: NewAccountRoute,
	},
);

function NewAccountRoute() {
	const { me, household } = Route.useRouteContext();
	const { redirect } = Route.useSearch();
	const navigate = useNavigate();

	return (
		<NewAccountPage
			me={me}
			household={household}
			onCreated={() =>
				redirect ? navigate({ href: redirect }) : navigate({ to: "/accounts" })
			}
		/>
	);
}
