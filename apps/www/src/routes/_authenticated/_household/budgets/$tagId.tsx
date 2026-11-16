import { monthSchema } from "@repo/schemas";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { BudgetPage } from "@/features/budgets/BudgetPage";
import { budgetsQueryOptions } from "@/features/budgets/budgets-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { todayIn } from "@/lib/dates";

const searchSchema = z.object({
	month: monthSchema.optional().catch(undefined),
});

export const Route = createFileRoute(
	"/_authenticated/_household/budgets/$tagId",
)({
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => ({ month: search.month }),
	loader: async ({ context, deps, params }) => {
		const { household, queryClient } = context;
		const month = deps.month ?? todayIn(household.timeZone).slice(0, 7);
		const [, tags] = await Promise.all([
			queryClient.ensureQueryData(budgetsQueryOptions(household.id, month)),
			queryClient.ensureQueryData(tagsQueryOptions(household.id)),
		]);
		// Not a tag of the household
		if (!tags.some((tag) => tag.id === params.tagId)) {
			throw notFound();
		}
	},
	component: BudgetRoute,
});

function BudgetRoute() {
	const { household } = Route.useRouteContext();
	const { tagId } = Route.useParams();
	const search = Route.useSearch();
	const month = search.month ?? todayIn(household.timeZone).slice(0, 7);
	const navigate = useNavigate();

	return (
		<BudgetPage
			household={household}
			month={month}
			tagId={tagId}
			onDone={() => navigate({ to: "/budgets", search: { month } })}
		/>
	);
}
