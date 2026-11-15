import type { Account } from "@repo/schemas";

export interface AccountGroups {
	/** Held by the signed-in user alone. */
	mine: Account[];
	/** Held by the signed-in user with other members. */
	shared: Account[];
	/** Held by other members, or by nobody. */
	others: Account[];
	/** Put aside, whoever holds them: they take no new transaction. */
	archived: Account[];
}

/** Sorts the household's accounts by what they are to the signed-in user. */
export function groupAccounts(accounts: Account[]): AccountGroups {
	const groups: AccountGroups = {
		mine: [],
		shared: [],
		others: [],
		archived: [],
	};
	for (const account of accounts) {
		if (account.archived) {
			groups.archived.push(account);
		} else if (!account.isHolder) {
			groups.others.push(account);
		} else if (account.holders.length > 1) {
			groups.shared.push(account);
		} else {
			groups.mine.push(account);
		}
	}
	return groups;
}
