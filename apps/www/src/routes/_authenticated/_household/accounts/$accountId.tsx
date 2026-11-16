import { NotFoundError } from "@repo/resources";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { accountQueryOptions } from "@/features/accounts/accounts-query";
import { EditAccountPage } from "@/features/accounts/EditAccountPage";
import { householdMembersQueryOptions } from "@/features/households/household-members-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";

const accountIdSchema = z.uuid();

export const Route = createFileRoute(
	"/_authenticated/_household/accounts/$accountId",
)({
	loader: async ({ context, params }) => {
		// Not an identifier: no need to ask the API
		if (!accountIdSchema.safeParse(params.accountId).success) {
			throw notFound();
		}
		const { household, queryClient } = context;
		try {
			await Promise.all([
				queryClient.ensureQueryData(
					accountQueryOptions(household.id, params.accountId),
				),
				queryClient.ensureQueryData(householdMembersQueryOptions(household.id)),
				queryClient.ensureQueryData(tagsQueryOptions(household.id)),
			]);
		} catch (error) {
			if (error instanceof NotFoundError) {
				throw notFound();
			}
			throw error;
		}
	},
	component: EditAccountRoute,
});

function EditAccountRoute() {
	const { me, household } = Route.useRouteContext();
	const { accountId } = Route.useParams();
	const navigate = useNavigate();

	return (
		<EditAccountPage
			me={me}
			household={household}
			accountId={accountId}
			onDone={() => navigate({ to: "/accounts" })}
		/>
	);
}
