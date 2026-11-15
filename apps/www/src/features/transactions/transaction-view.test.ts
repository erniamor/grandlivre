import type { Account, Tag, Transaction } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import {
	accountsWithDetails,
	groupByDay,
	transactionDirection,
	transactionTagNames,
} from "@/features/transactions/transaction-view";

const NOW = "2026-11-14T12:00:00.000Z";

function transaction(fields: Partial<Transaction> = {}): Transaction {
	return {
		id: "t",
		householdId: "h",
		type: "expense",
		date: "2026-11-14",
		accountId: "chequing",
		toAccountId: null,
		amount: 7200,
		payee: null,
		note: null,
		origin: "manual",
		receipt: null,
		lines: [],
		createdBy: null,
		createdAt: NOW,
		updatedAt: NOW,
		...fields,
	};
}

const transfer = transaction({ type: "transfer", toAccountId: "savings" });

describe("transactionDirection", () => {
	it("is out for an expense and in for an income, whatever the account looked at", () => {
		expect(transactionDirection(transaction())).toBe(-1);
		expect(transactionDirection(transaction({ type: "income" }))).toBe(1);
		expect(transactionDirection(transaction(), "chequing")).toBe(-1);
	});

	it("is neither for a transfer seen from the household", () => {
		expect(transactionDirection(transfer)).toBe(0);
		expect(transactionDirection(transfer, "cash")).toBe(0);
	});

	it("is out of the account a transfer leaves, and into the one it enters", () => {
		expect(transactionDirection(transfer, "chequing")).toBe(-1);
		expect(transactionDirection(transfer, "savings")).toBe(1);
	});
});

describe("transactionTagNames", () => {
	const tag = (id: string, names: Tag["names"]): Tag => ({
		id,
		householdId: "h",
		names,
		parentId: null,
		createdAt: NOW,
	});
	const tags = [
		tag("gas", { en: "Gas", fr: "Essence" }),
		tag("food", { fr: "Alimentation" }),
	];
	const line = (tagId: string | null) => ({ id: "l", amount: 100, tagId });

	it("names the tags of the lines in the user's language, in their order", () => {
		const split = transaction({ lines: [line("food"), line("gas")] });

		expect(transactionTagNames(split, tags, "fr")).toEqual([
			"Alimentation",
			"Essence",
		]);
		expect(transactionTagNames(split, tags, "en")).toEqual([
			"Alimentation",
			"Gas",
		]);
	});

	it("names a tag once, and stands null for uncategorized lines", () => {
		expect(
			transactionTagNames(
				transaction({
					lines: [line("gas"), line(null), line("gas"), line("deleted")],
				}),
				tags,
				"en",
			),
		).toEqual(["Gas", null]);
	});

	it("is empty for a transfer", () => {
		expect(transactionTagNames(transfer, tags, "en")).toEqual([]);
	});
});

describe("groupByDay", () => {
	it("gathers the transactions of a same day, keeping their order", () => {
		const a = transaction({ id: "a", date: "2026-11-14" });
		const b = transaction({ id: "b", date: "2026-11-14" });
		const c = transaction({ id: "c", date: "2026-11-01" });

		expect(groupByDay([a, b, c])).toEqual([
			{ day: "2026-11-14", transactions: [a, b] },
			{ day: "2026-11-01", transactions: [c] },
		]);
		expect(groupByDay([])).toEqual([]);
	});
});

describe("accountsWithDetails", () => {
	it("keeps the accounts the user holds or that show their details", () => {
		const account = (
			id: string,
			isHolder: boolean,
			visibility: Account["visibility"],
		) => ({ id, isHolder, visibility }) as Account;

		expect(
			accountsWithDetails([
				account("mine", true, "balance"),
				account("open", false, "details"),
				account("closed", false, "balance"),
			]).map((kept) => kept.id),
		).toEqual(["mine", "open"]);
	});
});
