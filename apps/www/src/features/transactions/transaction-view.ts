import {
	type Account,
	type Locale,
	type Tag,
	type Transaction,
	tagDisplayName,
} from "@repo/schemas";

/**
 * Which way a transaction moves money: -1 out, 1 in, 0 neither. A transfer
 * is neither for the household; seen from one of its accounts (`accountId`),
 * it leaves it or enters it.
 */
export function transactionDirection(
	transaction: Transaction,
	accountId?: string,
): -1 | 0 | 1 {
	if (transaction.type === "expense") {
		return -1;
	}
	if (transaction.type === "income") {
		return 1;
	}
	if (accountId === transaction.toAccountId) {
		return 1;
	}
	return accountId === transaction.accountId ? -1 : 0;
}

/**
 * The names of the tags of a transaction's lines in `locale`, each once, in
 * the order of the lines; null stands for the uncategorized lines. Empty
 * for a transfer.
 */
export function transactionTagNames(
	transaction: Transaction,
	tags: Tag[],
	locale: Locale,
): (string | null)[] {
	const tagById = new Map(tags.map((tag) => [tag.id, tag]));
	const names = transaction.lines.map((line) => {
		const tag = line.tagId === null ? undefined : tagById.get(line.tagId);
		return tag ? tagDisplayName(tag.names, locale) : null;
	});
	return [...new Set(names)];
}

/** Groups transactions, already sorted by day, under each of their days. */
export function groupByDay(
	transactions: Transaction[],
): { day: string; transactions: Transaction[] }[] {
	const days: { day: string; transactions: Transaction[] }[] = [];
	for (const transaction of transactions) {
		const last = days.at(-1);
		if (last?.day === transaction.date) {
			last.transactions.push(transaction);
		} else {
			days.push({ day: transaction.date, transactions: [transaction] });
		}
	}
	return days;
}

/** The accounts whose transactions the signed-in user may see. */
export function accountsWithDetails(accounts: Account[]): Account[] {
	return accounts.filter(
		(account) => account.isHolder || account.visibility === "details",
	);
}
