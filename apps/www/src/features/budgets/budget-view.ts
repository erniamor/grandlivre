import type { BudgetStatus } from "@repo/schemas";

/**
 * - "under": spent and planned fit in the budget;
 * - "near": what is spent reaches 80 % of it;
 * - "planned_over": spent fits, but not with what is still planned;
 * - "over": spent already goes past it.
 */
export type BudgetState = "under" | "near" | "planned_over" | "over";

export interface BudgetProgress {
	/** What is left, before what is planned; negative once over. */
	left: number;
	/** The parts of the bar, from 0 to 1: what is spent, then what is planned. */
	spentShare: number;
	plannedShare: number;
	state: BudgetState;
}

/** The share of a budget from which it is said to be near its end. */
export const NEAR_SHARE = 0.8;

/** Where a budget stands, from its amount, what is spent and what is planned. */
export function budgetProgress({
	amount,
	spent,
	upcoming,
}: Pick<BudgetStatus, "amount" | "spent" | "upcoming">): BudgetProgress {
	const spentShare = Math.min(1, spent / amount);
	const plannedShare = Math.min(1 - spentShare, upcoming / amount);
	const state: BudgetState =
		spent > amount
			? "over"
			: spent + upcoming > amount
				? "planned_over"
				: spent >= amount * NEAR_SHARE
					? "near"
					: "under";
	return { left: amount - spent, spentShare, plannedShare, state };
}

/** The sum of the monthly budgets: a yearly one doesn't add up with them. */
export function monthlyTotal(
	budgets: BudgetStatus[],
): Pick<BudgetStatus, "amount" | "spent" | "upcoming"> | null {
	const monthly = budgets.filter((budget) => budget.period === "month");
	if (monthly.length === 0) {
		return null;
	}
	return monthly.reduce(
		(total, budget) => ({
			amount: total.amount + budget.amount,
			spent: total.spent + budget.spent,
			upcoming: total.upcoming + budget.upcoming,
		}),
		{ amount: 0, spent: 0, upcoming: 0 },
	);
}

/** The month `step` months after `month` ("2026-11"), before when negative. */
export function shiftMonth(month: string, step: number): string {
	const [year = 0, monthNumber = 1] = month.split("-").map(Number);
	const total = year * 12 + (monthNumber - 1) + step;
	return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}
