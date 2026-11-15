import {
	ACCOUNT_DEBT_TYPES,
	type Account,
	type AccountType,
	type AccountVisibility,
} from "@repo/schemas";
import { formatAmountInput, parseAmount } from "@/lib/money";

/** What the account form sends: every field it shows. */
export interface AccountFormInput {
	name: string;
	type: AccountType;
	visibility: AccountVisibility;
	holderIds: string[];
	/** Missing when the user can't see, so can't change, the opening balance. */
	openingBalance?: number;
}

/** Credit cards and loans: the form asks what is owed, as a positive amount. */
export function isDebtType(type: AccountType): boolean {
	return ACCOUNT_DEBT_TYPES.includes(type);
}

/**
 * The opening balance in minor units from what the user typed, or null when
 * it isn't an amount. For a debt, the amount owed is stored as a negative balance.
 */
export function toOpeningBalance(
	text: string,
	type: AccountType,
	currency: string,
	locale: string,
): number | null {
	const amount = parseAmount(text, currency, locale);
	if (amount === null || amount === 0 || !isDebtType(type)) {
		return amount;
	}
	return -amount;
}

/** The text of the balance field for an opening balance: the reverse of `toOpeningBalance()`. */
export function toBalanceText(
	openingBalance: number,
	type: AccountType,
	currency: string,
	locale: string,
): string {
	const shown =
		isDebtType(type) && openingBalance !== 0 ? -openingBalance : openingBalance;
	return formatAmountInput(shown, currency, locale);
}

/**
 * Whether the signed-in user may change or delete the account: its holders,
 * or an owner of the household while the account has no holder left.
 */
export function canEditAccount(
	account: Account,
	isHouseholdOwner: boolean,
): boolean {
	return account.isHolder || (account.holders.length === 0 && isHouseholdOwner);
}
