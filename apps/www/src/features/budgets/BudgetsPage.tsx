import type { Household } from "@repo/schemas";
import { buttonVariants, cn } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useId } from "react";
import { BudgetBar } from "@/features/budgets/BudgetBar";
import { BudgetFigures } from "@/features/budgets/BudgetFigures";
import { BudgetMonthNav } from "@/features/budgets/BudgetMonthNav";
import { BudgetRow } from "@/features/budgets/BudgetRow";
import { budgetProgress, monthlyTotal } from "@/features/budgets/budget-view";
import { budgetsQueryOptions } from "@/features/budgets/budgets-query";
import { buildTagTree, flattenTagTree } from "@/features/tags/tag-tree";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface BudgetsPageProps {
	household: Household;
	/** The month shown: "2026-11". */
	month: string;
}

/** The household's budgets in a month, and where each stands. */
export function BudgetsPage({ household, month }: BudgetsPageProps) {
	const { data } = useSuspenseQuery(budgetsQueryOptions(household.id, month));
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const totalId = useId();
	const paths = new Map(
		flattenTagTree(buildTagTree(tags, getLocale())).map(({ tag, path }) => [
			tag.id,
			path,
		]),
	);
	const total = monthlyTotal(data.budgets, tags);

	return (
		<section className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
			<header className="grid gap-2">
				<h1 className="font-heading font-semibold text-2xl">
					{m.budgets_title()}
				</h1>
				<p className="text-muted-foreground">{m.budgets_intro()}</p>
			</header>
			<BudgetMonthNav month={month} />
			<Link
				to="/budgets/new"
				search={{ month }}
				className={cn(buttonVariants(), "justify-self-start")}
			>
				<PlusIcon aria-hidden />
				{m.budget_add_button()}
			</Link>
			{total && (
				<section
					aria-labelledby={totalId}
					className="grid gap-2 rounded-lg bg-muted p-4"
				>
					<h2 id={totalId} className="font-medium">
						{m.budgets_total_title()}
					</h2>
					<BudgetBar progress={budgetProgress(total)} />
					<BudgetFigures
						{...total}
						progress={budgetProgress(total)}
						currency={household.currency}
					/>
				</section>
			)}
			{data.budgets.length === 0 ? (
				<p className="text-muted-foreground">{m.budgets_empty()}</p>
			) : (
				<ul className="grid gap-2">
					{data.budgets.map((budget) => (
						<BudgetRow
							key={budget.tagId}
							budget={budget}
							name={paths.get(budget.tagId) ?? m.budget_unknown_tag()}
							month={month}
							currency={household.currency}
						/>
					))}
				</ul>
			)}
		</section>
	);
}
