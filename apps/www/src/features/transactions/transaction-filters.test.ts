import type { Account } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import {
	fromSearch,
	hasFilters,
	hidesTransactions,
	toSearch,
} from "@/features/transactions/transaction-filters";

describe("the filters of the list", () => {
	const filters = {
		accountId: "chequing",
		tagId: "food",
		from: "2026-11-01",
		to: "2026-11-30",
		q: "café",
		type: "expense" as const,
		minAmount: 2_500,
		maxAmount: 50_000,
	};

	it("are written in the address, and read back", () => {
		expect(toSearch(filters, 2)).toEqual({
			account: "chequing",
			tag: "food",
			from: "2026-11-01",
			to: "2026-11-30",
			q: "café",
			type: "expense",
			min: 2_500,
			max: 50_000,
			page: 2,
		});
		expect(fromSearch(toSearch(filters))).toEqual(filters);
	});

	it("tell when there is one", () => {
		expect(hasFilters({})).toBe(false);
		expect(hasFilters({ tagId: "food" })).toBe(true);
		expect(hasFilters({ to: "2026-11-30" })).toBe(true);
		expect(hasFilters({ minAmount: 0 })).toBe(true);
	});
});

describe("hidesTransactions", () => {
	const account = (isHolder: boolean, visibility: Account["visibility"]) =>
		({ isHolder, visibility }) as Account;

	it("is true when the user doesn't hold an account that shows only its balance", () => {
		expect(hidesTransactions([account(true, "balance")])).toBe(false);
		expect(hidesTransactions([account(false, "details")])).toBe(false);
		expect(
			hidesTransactions([account(true, "details"), account(false, "balance")]),
		).toBe(true);
	});
});
