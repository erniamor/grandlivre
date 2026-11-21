import type { Account, TransactionType } from "@repo/schemas";

/**
 * The expenses and incomes with a line without a tag: still to categorize,
 * or set aside as undetermined.
 */
export type Untagged = "to-define" | "undetermined";

export const UNTAGGED_VALUES = ["to-define", "undetermined"] as const;

/** What narrows the list of transactions; every filter is optional. */
export interface TransactionListFilters {
	accountId?: string;
	/** The tag, and the tags under it. */
	tagId?: string;
	/** From this day on, included: "2026-11-01". */
	from?: string;
	/** Up to this day, included. */
	to?: string;
	/** Words searched in the payee, the note and a receipt's merchant and items. */
	q?: string;
	type?: TransactionType;
	/** The transaction's total, in minor units: at least this much. */
	minAmount?: number;
	/** At most this much. */
	maxAmount?: number;
	untagged?: Untagged;
}

/** The filters as the page's address writes them: `?account=…&tag=…&q=…&min=…`. */
export interface TransactionsSearch {
	account?: string;
	tag?: string;
	from?: string;
	to?: string;
	q?: string;
	type?: TransactionType;
	min?: number;
	max?: number;
	untagged?: Untagged;
	page?: number;
}

export function toSearch(
	{
		accountId,
		tagId,
		from,
		to,
		q,
		type,
		minAmount,
		maxAmount,
		untagged,
	}: TransactionListFilters,
	page?: number,
): TransactionsSearch {
	return {
		account: accountId,
		tag: tagId,
		from,
		to,
		q,
		type,
		min: minAmount,
		max: maxAmount,
		untagged,
		page,
	};
}

export function fromSearch({
	account,
	tag,
	from,
	to,
	q,
	type,
	min,
	max,
	untagged,
}: TransactionsSearch): TransactionListFilters {
	return {
		accountId: account,
		tagId: tag,
		from,
		to,
		q,
		type,
		minAmount: min,
		maxAmount: max,
		untagged,
	};
}

export function hasFilters(filters: TransactionListFilters): boolean {
	return Object.values(filters).some((value) => value !== undefined);
}

/**
 * Whether some accounts of the household hide their transactions from the
 * user: they count in the reports, but their transactions aren't listed.
 */
export function hidesTransactions(accounts: Account[]): boolean {
	return accounts.some(
		(account) => !account.isHolder && account.visibility === "balance",
	);
}
