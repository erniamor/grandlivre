import type { BudgetPeriod } from "@repo/schemas";
import { Button } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { SparklesIcon } from "lucide-react";
import { budgetSuggestionQueryOptions } from "@/features/budgets/budgets-query";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface BudgetSuggestionProps {
	householdId: string;
	tagId: string;
	/** The month the budget applies from: the suggestion looks before it. */
	month: string;
	period: BudgetPeriod;
	currency: string;
	/** Puts the amount suggested in the form. */
	onUse: (amount: number) => void;
}

/**
 * What the tag usually costs, to start from: nothing shows while it loads,
 * nor when the tag cost nothing yet.
 */
export function BudgetSuggestion({
	householdId,
	tagId,
	month,
	period,
	currency,
	onUse,
}: BudgetSuggestionProps) {
	const { data } = useQuery(
		budgetSuggestionQueryOptions(householdId, tagId, month),
	);
	const amount = data ? data[period] : 0;
	if (amount <= 0) {
		return null;
	}
	const money = formatAmount(amount, currency, getLocale());

	return (
		<p className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
			<SparklesIcon aria-hidden className="size-4 shrink-0" />
			<span>
				{period === "month"
					? m.budget_suggestion_month({ amount: money })
					: m.budget_suggestion_year({ amount: money })}
			</span>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={() => onUse(amount)}
			>
				{m.budget_suggestion_use()}
			</Button>
		</p>
	);
}
