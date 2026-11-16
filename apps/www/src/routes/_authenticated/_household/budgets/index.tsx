import { monthSchema } from "@repo/schemas";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { BudgetsPage } from "@/features/budgets/BudgetsPage";
import { budgetsQueryOptions } from "@/features/budgets/budgets-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { todayIn } from "@/lib/dates";

// The month shown; anything invalid is dropped, for the current month
const searchSchema = z.object({
	month: monthSchema.optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/_household/budgets/")({
	validateSearch: searchSchema,
	beforeLoad: ({ search, context }) => {
		// No month: the household's current one, written in the address
		if (!search.month) {
			throw redirect({
				to: "/budgets",
				search: { month: todayIn(context.household.timeZone).slice(0, 7) },
			});
		}
	},
	loaderDeps: ({ search }) => ({ month: search.month ?? "" }),
	loader: ({ context, deps }) => {
		const { household, queryClient } = context;
		return Promise.all([
			queryClient.ensureQueryData(
				budgetsQueryOptions(household.id, deps.month),
			),
			queryClient.ensureQueryData(tagsQueryOptions(household.id)),
		]);
	},
	component: BudgetsRoute,
});

function BudgetsRoute() {
	const { household } = Route.useRouteContext();
	const { month } = Route.useLoaderDeps();

	return <BudgetsPage household={household} month={month} />;
}
