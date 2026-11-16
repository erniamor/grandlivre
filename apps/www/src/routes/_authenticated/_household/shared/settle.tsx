import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { SettlePage } from "@/features/sharing/SettlePage";
import { sharingOverviewQueryOptions } from "@/features/sharing/sharing-query";

// The payment proposed; anything invalid is dropped
const searchSchema = z.object({
	from: z.uuid().optional().catch(undefined),
	to: z.uuid().optional().catch(undefined),
	amount: z.number().int().positive().optional().catch(undefined),
});

export const Route = createFileRoute(
	"/_authenticated/_household/shared/settle",
)({
	validateSearch: searchSchema,
	beforeLoad: ({ context }) => {
		if (!context.household.expenseSharing) {
			throw notFound();
		}
	},
	loader: ({ context }) => {
		const { household, queryClient } = context;
		return Promise.all([
			queryClient.ensureQueryData(sharingOverviewQueryOptions(household.id)),
			queryClient.ensureQueryData(accountsQueryOptions(household.id)),
		]);
	},
	component: SettleRoute,
});

function SettleRoute() {
	const { household, me } = Route.useRouteContext();
	const proposed = Route.useSearch();
	const navigate = useNavigate();

	return (
		<SettlePage
			household={household}
			meId={me.id}
			proposed={proposed}
			onSettled={() => navigate({ to: "/shared" })}
		/>
	);
}
