import type { Account } from "@repo/schemas";

/** What narrows the list of transactions; every filter is optional. */
export interface TransactionListFilters {
	accountId?: string;
	/** The tag, and the tags under it. */
	tagId?: string;
	/** From this day on, included: "2026-11-01". */
	from?: string;
	/** Up to this day, included. */
	to?: string;
}

/** The filters as the page's address writes them: `?account=…&tag=…&from=…&to=…`. */
export interface TransactionsSearch {
	account?: string;
	tag?: string;
	from?: string;
	to?: string;
	page?: number;
}

export function toSearch(
	{ accountId, tagId, from, to }: TransactionListFilters,
	page?: number,
): TransactionsSearch {
	return { account: accountId, tag: tagId, from, to, page };
}

export function fromSearch({
	account,
	tag,
	from,
	to,
}: TransactionsSearch): TransactionListFilters {
	return { accountId: account, tagId: tag, from, to };
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
