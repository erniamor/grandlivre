import type { Household } from "@repo/schemas";
import { cn } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { cardClass } from "@/components/card-styles";
import { BudgetRow } from "@/features/budgets/BudgetRow";
import { byRisk } from "@/features/budgets/budget-view";
import { budgetsQueryOptions } from "@/features/budgets/budgets-query";
import { buildTagTree, flattenTagTree } from "@/features/tags/tag-tree";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

/** How many budgets the dashboard shows. */
export const OVERVIEW_BUDGETS = 4;

interface BudgetsOverviewProps {
	household: Household;
	/** The household's current month: "2026-11". */
	month: string;
}

/**
 * The month's budgets the closest to their end, with a link to all of
 * them. Nothing shows when the household has no budget this month.
 */
export function BudgetsOverview({ household, month }: BudgetsOverviewProps) {
	const { data } = useSuspenseQuery(budgetsQueryOptions(household.id, month));
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const titleId = useId();

	if (data.budgets.length === 0) {
		return null;
	}
	const paths = new Map(
		flattenTagTree(buildTagTree(tags, getLocale())).map(({ tag, path }) => [
			tag.id,
			path,
		]),
	);
	const shown = byRisk(data.budgets).slice(0, OVERVIEW_BUDGETS);

	return (
		<section aria-labelledby={titleId} className={cn("grid gap-3", cardClass)}>
			<h2 id={titleId} className="font-heading font-semibold text-lg">
				{m.budgets_overview_title()}
			</h2>
			<ul className="grid gap-2 sm:grid-cols-2">
				{shown.map((budget) => (
					<BudgetRow
						key={budget.tagId}
						budget={budget}
						name={paths.get(budget.tagId) ?? m.budget_unknown_tag()}
						month={month}
						currency={household.currency}
					/>
				))}
			</ul>
			<Link
				to="/budgets"
				search={{ month }}
				className="justify-self-start rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
			>
				{data.budgets.length > shown.length
					? m.budgets_overview_link_more({
							count: data.budgets.length - shown.length,
						})
					: m.budgets_overview_link()}
			</Link>
		</section>
	);
}
