import { monthSchema } from "@repo/schemas";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { BudgetPage } from "@/features/budgets/BudgetPage";
import { budgetsQueryOptions } from "@/features/budgets/budgets-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { todayIn } from "@/lib/dates";

const searchSchema = z.object({
	month: monthSchema.optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/_household/budgets/new")({
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => ({ month: search.month }),
	loader: ({ context, deps }) => {
		const { household, queryClient } = context;
		const month = deps.month ?? todayIn(household.timeZone).slice(0, 7);
		return Promise.all([
			queryClient.ensureQueryData(budgetsQueryOptions(household.id, month)),
			queryClient.ensureQueryData(tagsQueryOptions(household.id)),
		]);
	},
	component: NewBudgetRoute,
});

function NewBudgetRoute() {
	const { household } = Route.useRouteContext();
	const search = Route.useSearch();
	const month = search.month ?? todayIn(household.timeZone).slice(0, 7);
	const navigate = useNavigate();

	return (
		<BudgetPage
			household={household}
			month={month}
			onDone={() => navigate({ to: "/budgets", search: { month } })}
		/>
	);
}
