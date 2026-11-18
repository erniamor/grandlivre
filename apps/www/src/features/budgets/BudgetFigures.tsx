import { cn } from "@repo/ui";
import { CircleAlertIcon, TriangleAlertIcon } from "lucide-react";
import { sensitiveClass } from "@/components/sensitive";
import type { BudgetProgress } from "@/features/budgets/budget-view";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface BudgetFiguresProps {
	amount: number;
	spent: number;
	upcoming: number;
	progress: BudgetProgress;
	currency: string;
}

/**
 * Where a budget stands, in words: what is spent of it, what is planned,
 * what is left, or by how much it is over. A warning never relies on its
 * color alone: it has its words and an icon.
 */
export function BudgetFigures({
	amount,
	spent,
	upcoming,
	progress,
	currency,
}: BudgetFiguresProps) {
	const locale = getLocale();
	const money = (value: number) => formatAmount(value, currency, locale);
	const warning =
		progress.state === "over"
			? m.budget_over({ amount: money(spent - amount) })
			: progress.state === "planned_over"
				? m.budget_planned_over({ amount: money(spent + upcoming - amount) })
				: null;

	return (
		<div className={cn("grid gap-0.5 text-sm", sensitiveClass)}>
			<p>
				{m.budget_spent_of({ spent: money(spent), amount: money(amount) })}
				{upcoming > 0 && (
					<span className="text-muted-foreground">
						{" · "}
						{m.budget_planned({ amount: money(upcoming) })}
					</span>
				)}
			</p>
			{warning ? (
				<p
					className={cn(
						"flex items-center gap-1.5 font-medium",
						progress.state === "over" ? "text-destructive" : "text-foreground",
					)}
				>
					{progress.state === "over" ? (
						<TriangleAlertIcon aria-hidden className="size-4 shrink-0" />
					) : (
						<CircleAlertIcon aria-hidden className="size-4 shrink-0" />
					)}
					{warning}
				</p>
			) : (
				<p className="text-muted-foreground">
					{m.budget_left({ amount: money(progress.left) })}
				</p>
			)}
		</div>
	);
}
