import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { TransactionsPage } from "@/features/transactions/TransactionsPage";
import { transactionsQueryOptions } from "@/features/transactions/transactions-query";

// The account filtered on and the page shown; anything invalid is dropped
const searchSchema = z.object({
	account: z.uuid().optional().catch(undefined),
	page: z.number().int().min(1).optional().catch(undefined),
});

export const Route = createFileRoute(
	"/_authenticated/_household/transactions/",
)({
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => ({
		accountId: search.account,
		page: search.page ?? 1,
	}),
	loader: ({ context, deps }) => {
		const { household, queryClient } = context;
		return Promise.all([
			queryClient.ensureQueryData(transactionsQueryOptions(household.id, deps)),
			queryClient.ensureQueryData(accountsQueryOptions(household.id)),
			queryClient.ensureQueryData(tagsQueryOptions(household.id)),
		]);
	},
	component: TransactionsRoute,
});

function TransactionsRoute() {
	const { household } = Route.useRouteContext();
	const { accountId, page } = Route.useLoaderDeps();
	const navigate = useNavigate();

	return (
		<TransactionsPage
			household={household}
			accountId={accountId}
			page={page}
			// Another account: back to its first page
			onAccountChange={(account) =>
				navigate({ to: "/transactions", search: { account } })
			}
		/>
	);
}
