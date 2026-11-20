import { calendarDateSchema, transactionTypeSchema } from "@repo/schemas";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { TransactionsPage } from "@/features/transactions/TransactionsPage";
import {
	fromSearch,
	toSearch,
} from "@/features/transactions/transaction-filters";
import { transactionsQueryOptions } from "@/features/transactions/transactions-query";

// The filters and the page shown; anything invalid is dropped
const searchSchema = z.object({
	account: z.uuid().optional().catch(undefined),
	tag: z.uuid().optional().catch(undefined),
	from: calendarDateSchema.optional().catch(undefined),
	to: calendarDateSchema.optional().catch(undefined),
	// An empty search is no search
	q: z
		.string()
		.trim()
		.max(100)
		.transform((value) => value || undefined)
		.optional()
		.catch(undefined),
	type: transactionTypeSchema.optional().catch(undefined),
	min: z.number().int().min(0).optional().catch(undefined),
	max: z.number().int().min(0).optional().catch(undefined),
	page: z.number().int().min(1).optional().catch(undefined),
});

export const Route = createFileRoute(
	"/_authenticated/_household/transactions/",
)({
	validateSearch: searchSchema,
	beforeLoad: ({ search }) => {
		// A period that ends before it starts: dropped, the rest kept
		if (search.from && search.to && search.from > search.to) {
			throw redirect({
				to: "/transactions",
				search: { ...search, from: undefined, to: undefined },
			});
		}
		// Likewise an amount range upside down
		if (
			search.min !== undefined &&
			search.max !== undefined &&
			search.min > search.max
		) {
			throw redirect({
				to: "/transactions",
				search: { ...search, min: undefined, max: undefined },
			});
		}
	},
	loaderDeps: ({ search }) => ({
		...fromSearch(search),
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
	const { page, ...filters } = Route.useLoaderDeps();
	const navigate = useNavigate();

	return (
		<TransactionsPage
			household={household}
			filters={filters}
			page={page}
			onFiltersChange={(next) =>
				navigate({ to: "/transactions", search: toSearch(next) })
			}
		/>
	);
}
