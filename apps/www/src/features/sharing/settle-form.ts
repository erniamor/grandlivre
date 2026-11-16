import type { Account, CreateSettlement } from "@repo/schemas";
import { parseAmount } from "@/lib/money";

/** A settlement as the form holds it, as typed. */
export interface SettleFormState {
	fromUserId: string;
	toUserId: string;
	amount: string;
	date: string;
	note: string;
	/** Whether the payment is also recorded as a transfer between accounts. */
	transfer: boolean;
	fromAccountId: string;
	toAccountId: string;
}

/** The accounts a member holds, not archived: where a payment can go or leave. */
export function accountsHeldBy(accounts: Account[], userId: string): Account[] {
	return accounts.filter(
		(account) =>
			!account.archived &&
			account.holders.some((holder) => holder.userId === userId),
	);
}

type SettleResult =
	| { ok: true; input: CreateSettlement }
	| { ok: false; errors: Record<string, string> };

/** What the form sends, from what the user typed; or the errors to show. */
export function toSettlementInput(
	state: SettleFormState,
	currency: string,
	locale: string,
): SettleResult {
	const errors: Record<string, string> = {};
	if (!state.fromUserId || !state.toUserId) {
		errors.toUserId = "share_members_required";
	} else if (state.fromUserId === state.toUserId) {
		errors.toUserId = "settlement_same_member";
	}
	const amount = parseAmount(state.amount, currency, locale);
	if (amount === null) {
		errors.amount = "amount_invalid";
	} else if (amount <= 0) {
		errors.amount = "amount_not_positive";
	}
	if (!state.date) {
		errors.date = "date_invalid";
	}
	if (state.transfer && !state.fromAccountId) {
		errors["transfer.fromAccountId"] = "transaction_account_required";
	}
	if (state.transfer && !state.toAccountId) {
		errors["transfer.toAccountId"] = "transaction_account_required";
	}
	if (amount === null || Object.keys(errors).length > 0) {
		return { ok: false, errors };
	}
	return {
		ok: true,
		input: {
			fromUserId: state.fromUserId,
			toUserId: state.toUserId,
			amount,
			date: state.date,
			note: state.note.trim() || null,
			...(state.transfer
				? {
						transfer: {
							fromAccountId: state.fromAccountId,
							toAccountId: state.toAccountId,
						},
					}
				: {}),
		},
	};
}
