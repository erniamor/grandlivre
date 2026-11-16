import { cn } from "@repo/ui";
import type { BudgetProgress } from "@/features/budgets/budget-view";

interface BudgetBarProps {
	progress: BudgetProgress;
}

/**
 * What is spent, then what is planned, against the budget: a picture of
 * what the text next to it says, hidden from screen readers.
 */
export function BudgetBar({ progress }: BudgetBarProps) {
	const over = progress.state === "over";
	return (
		<div
			aria-hidden
			className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
		>
			{progress.spentShare > 0 && (
				<div
					className={cn(
						"h-full rounded-full",
						over ? "bg-destructive" : "bg-primary",
					)}
					style={{ width: `${progress.spentShare * 100}%` }}
				/>
			)}
			{progress.plannedShare > 0 && (
				<div
					className="h-full rounded-full bg-primary/40"
					style={{ width: `${progress.plannedShare * 100}%` }}
				/>
			)}
		</div>
	);
}
