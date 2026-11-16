import type { BudgetPeriod, BudgetStatus, SetBudget } from "@repo/schemas";
import { monthSchema } from "@repo/schemas";
import { formatAmountInput, parseAmount } from "@/lib/money";

/** A budget as the form holds it, as typed. */
export interface BudgetFormState {
	/** Empty while no tag is chosen. */
	tagId: string;
	period: BudgetPeriod;
	/** As typed: "500", "500,00". */
	amount: string;
	/** The month it applies from: "2026-11". */
	from: string;
}

/** The form for a budget: the one in force, or a new monthly one. */
export function budgetFormState(
	month: string,
	currency: string,
	locale: string,
	{ tagId = "", budget }: { tagId?: string; budget?: BudgetStatus } = {},
): BudgetFormState {
	return {
		tagId: budget?.tagId ?? tagId,
		period: budget?.period ?? "month",
		amount: budget ? formatAmountInput(budget.amount, currency, locale) : "",
		from: month,
	};
}

type BudgetResult =
	| { ok: true; tagId: string; input: SetBudget }
	| { ok: false; errors: Record<string, string> };

/** What the form sends, from what the user typed; or the errors to show. */
export function toSetBudgetInput(
	state: BudgetFormState,
	currency: string,
	locale: string,
): BudgetResult {
	const errors: Record<string, string> = {};
	if (!state.tagId) {
		errors.tagId = "budget_tag_required";
	}
	const amount = parseAmount(state.amount, currency, locale);
	if (amount === null) {
		errors.amount = "amount_invalid";
	} else if (amount <= 0) {
		errors.amount = "amount_not_positive";
	}
	if (!monthSchema.safeParse(state.from).success) {
		errors.from = "budget_month_invalid";
	}
	if (amount === null || Object.keys(errors).length > 0) {
		return { ok: false, errors };
	}
	return {
		ok: true,
		tagId: state.tagId,
		input: { period: state.period, amount, from: state.from },
	};
}
