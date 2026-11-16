import type { AccountType, AdjustAccount } from "@repo/schemas";
import { toOpeningBalance } from "@/features/accounts/account-form";

/** What the adjustment form holds, as typed. */
export interface AdjustFormState {
	/** What the account really holds; for a debt, what is owed. */
	balance: string;
	date: string;
	/** Empty for an uncategorized adjustment. */
	tagId: string;
}

/**
 * The balance typed, in minor units as the API counts it (a debt negative),
 * or null while it isn't an amount.
 */
export function typedBalance(
	text: string,
	type: AccountType,
	currency: string,
	locale: string,
): number | null {
	// The same reading as an account's opening balance
	return text.trim() === ""
		? null
		: toOpeningBalance(text, type, currency, locale);
}

/**
 * What the adjustment will record: negative for what was spent and not
 * noted (an expense), positive for more than expected (an income).
 */
export function adjustmentGap(expected: number, actual: number): number {
	return actual - expected;
}

type AdjustResult =
	| { ok: true; input: AdjustAccount }
	| { ok: false; errors: Record<string, string> };

/** What the form sends, from what was typed; or the errors to show. */
export function toAdjustInput(
	state: AdjustFormState,
	type: AccountType,
	currency: string,
	locale: string,
): AdjustResult {
	const errors: Record<string, string> = {};
	const balance = typedBalance(state.balance, type, currency, locale);
	if (balance === null) {
		errors.balance = "amount_invalid";
	}
	if (!state.date) {
		errors.date = "date_invalid";
	}
	if (balance === null || Object.keys(errors).length > 0) {
		return { ok: false, errors };
	}
	return {
		ok: true,
		input: {
			balance,
			date: state.date,
			...(state.tagId ? { tagId: state.tagId } : {}),
		},
	};
}
