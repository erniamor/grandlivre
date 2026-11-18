import type { Account, Household, Tag, Transaction } from "@repo/schemas";
import type { ApiRequest, ApiResponse } from "@/test/mock-api";
import { aliceProfile } from "@/test/mock-api";

// Data shared by the tests of the pages that show transactions

const NOW = "2026-11-14T12:00:00.000Z";

const id = (n: number) =>
	`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const household: Household = {
	id: "7d6c5b4a-3f2e-4d1c-8b0a-9f8e7d6c5b4a",
	name: "The Tremblays",
	currency: "CAD",
	timeZone: "America/Toronto",
	expenseSharing: false,
	role: "owner",
	createdAt: NOW,
};

export const base = `/households/${household.id}`;

function account(
	n: number,
	fields: Partial<Account> & { name: string },
): Account {
	return {
		id: id(n),
		householdId: household.id,
		type: "checking",
		visibility: "details",
		balance: 0,
		openingBalance: 0,
		holders: [{ userId: aliceProfile.id, name: "Alice" }],
		isHolder: true,
		archived: false,
		createdAt: NOW,
		...fields,
	};
}

export const chequing = account(1, { name: "Everyday" });
export const savings = account(2, { name: "Savings", type: "savings" });
/** Bob's: Alice sees its balance, not its transactions. */
export const bobsCard = account(3, {
	name: "Bob's Visa",
	type: "credit_card",
	visibility: "balance",
	holders: [{ userId: id(99), name: "Bob" }],
	isHolder: false,
	openingBalance: null,
});

export const accounts = [chequing, savings, bobsCard];

function tag(n: number, names: Tag["names"]): Tag {
	return {
		id: id(10 + n),
		householdId: household.id,
		names,
		parentId: null,
		createdAt: NOW,
	};
}

export const gas = tag(1, { en: "Gas", fr: "Essence", es: "Gasolina" });
export const food = tag(2, {
	en: "Food",
	fr: "Alimentation",
	es: "Alimentación",
});

export const tags = [gas, food];

let nextLine = 0;

function transaction(n: number, fields: Partial<Transaction>): Transaction {
	return {
		id: id(100 + n),
		householdId: household.id,
		type: "expense",
		date: "2026-11-14",
		accountId: chequing.id,
		toAccountId: null,
		amount: 0,
		payee: null,
		note: null,
		origin: "manual",
		receipt: null,
		lines: [],
		createdBy: { userId: aliceProfile.id, name: "Alice" },
		createdAt: NOW,
		updatedAt: NOW,
		...fields,
	};
}

const line = (amount: number, tagId: string | null) => {
	nextLine += 1;
	return { id: id(1000 + nextLine), amount, tagId };
};

export const fillUp = transaction(1, {
	payee: "Shell",
	amount: 7200,
	lines: [line(7200, gas.id)],
});

/** Split between two tags and an uncategorized line. */
export const groceries = transaction(2, {
	payee: "Costco",
	amount: 18_000,
	note: "Monthly run",
	lines: [line(12_000, food.id), line(4500, gas.id), line(1500, null)],
});

export const salary = transaction(3, {
	type: "income",
	date: "2026-11-01",
	payee: "Employer",
	amount: 250_000,
	lines: [line(250_000, null)],
});

export const toSavings = transaction(4, {
	type: "transfer",
	date: "2026-11-01",
	toAccountId: savings.id,
	amount: 30_000,
});

/** Without a payee: named after its type. */
export const cashExpense = transaction(5, {
	date: "2026-10-31",
	amount: 500,
	lines: [line(500, null)],
});

/** Most recent first, as the API returns them. */
export const transactions = [fillUp, groceries, salary, toSavings, cashExpense];

export function page(items: unknown[], fields: object = {}): ApiResponse {
	return {
		status: 200,
		body: {
			data: items,
			pagination: { page: 1, pageSize: 50, total: items.length, ...fields },
		},
	};
}

/**
 * Answers the reads of a page that shows transactions: the accounts, the
 * tags, the consolidated balance, the transactions given, and no recurring
 * transaction waiting or to come.
 */
export function respondWith(
	items: Transaction[] = transactions,
	pagination: object = {},
) {
	return (request: ApiRequest): ApiResponse | undefined => {
		if (request.method !== "GET") {
			return undefined;
		}
		if (request.path === `${base}/accounts/summary`) {
			return {
				status: 200,
				body: { assets: 1_125_050, liabilities: -45_000, balance: 1_080_050 },
			};
		}
		if (request.path === `${base}/accounts`) {
			return page(accounts, { pageSize: 100 });
		}
		if (request.path === `${base}/tags`) {
			return page(tags, { pageSize: 500 });
		}
		if (request.path === `${base}/transactions`) {
			return page(items, pagination);
		}
		// Nothing spent nor earned in the period asked
		if (request.path === `${base}/reports/tags`) {
			return {
				status: 200,
				body: { from: "2026-11-01", to: "2026-11-30", tags: [] },
			};
		}
		// No month with a line
		if (request.path === `${base}/reports/monthly`) {
			return { status: 200, body: { months: [] } };
		}
		// Every payee sorted
		if (request.path === `${base}/transactions/uncategorized`) {
			return page([], { pageSize: 200 });
		}
		// No budget this month
		if (request.path === `${base}/budgets`) {
			return { status: 200, body: { month: "2026-11", budgets: [] } };
		}
		// No recurring transaction waits or comes
		if (
			request.path === `${base}/recurring-transactions/pending` ||
			request.path === `${base}/recurring-transactions/upcoming`
		) {
			return page([]);
		}
		return undefined;
	};
}
