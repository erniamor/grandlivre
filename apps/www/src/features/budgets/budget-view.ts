import type { BudgetStatus, Tag } from "@repo/schemas";

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

/**
 * The sum of the monthly budgets. A yearly one doesn't add up with them, and
 * a budget under a tag that has its own is already in it: counted once.
 */
export function monthlyTotal(
	budgets: BudgetStatus[],
	tags: Pick<Tag, "id" | "parentId">[],
): Pick<BudgetStatus, "amount" | "spent" | "upcoming"> | null {
	const parentOf = new Map(tags.map((tag) => [tag.id, tag.parentId]));
	const budgeted = new Set(
		budgets
			.filter((budget) => budget.period === "month")
			.map((budget) => budget.tagId),
	);
	const hasBudgetedAncestor = (tagId: string) => {
		let parent = parentOf.get(tagId) ?? null;
		const seen = new Set<string>();
		while (parent !== null && !seen.has(parent)) {
			if (budgeted.has(parent)) {
				return true;
			}
			seen.add(parent);
			parent = parentOf.get(parent) ?? null;
		}
		return false;
	};
	const monthly = budgets.filter(
		(budget) => budget.period === "month" && !hasBudgetedAncestor(budget.tagId),
	);
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

const riskOrder: Record<BudgetState, number> = {
	over: 0,
	planned_over: 1,
	near: 2,
	under: 3,
};

/**
 * The budgets the closest to their end first: the ones over, then the ones
 * planned over, then near, then the rest; within each, the most spent first.
 */
export function byRisk(budgets: BudgetStatus[]): BudgetStatus[] {
	return [...budgets].sort((a, b) => {
		const first = budgetProgress(a);
		const second = budgetProgress(b);
		return (
			riskOrder[first.state] - riskOrder[second.state] ||
			b.spent / b.amount - a.spent / a.amount
		);
	});
}
