import type { BudgetStatus } from "@repo/schemas";
import { Link } from "@tanstack/react-router";
import { BudgetBar } from "@/features/budgets/BudgetBar";
import { BudgetFigures } from "@/features/budgets/BudgetFigures";
import { budgetProgress } from "@/features/budgets/budget-view";
import { m } from "@/paraglide/messages";

interface BudgetRowProps {
	budget: BudgetStatus;
	/** The tag's path in the user's language: "Food › Groceries". */
	name: string;
	/** The month shown, kept when the budget is opened. */
	month: string;
	currency: string;
}

/** One budget: its tag, its bar, and where it stands in words. */
export function BudgetRow({ budget, name, month, currency }: BudgetRowProps) {
	const progress = budgetProgress(budget);

	return (
		<li className="grid gap-2 rounded-lg border border-border bg-card p-4 text-card-foreground">
			<div className="flex flex-wrap items-baseline justify-between gap-x-4">
				<Link
					to="/budgets/$tagId"
					params={{ tagId: budget.tagId }}
					search={{ month }}
					className="rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
				>
					{name}
				</Link>
				{budget.period === "year" && (
					<span className="text-muted-foreground text-sm">
						{m.budget_yearly({ year: month.slice(0, 4) })}
					</span>
				)}
			</div>
			<BudgetBar progress={progress} />
			<BudgetFigures
				amount={budget.amount}
				spent={budget.spent}
				upcoming={budget.upcoming}
				progress={progress}
				currency={currency}
			/>
		</li>
	);
}
