import type { Account, Transaction } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import {
	canEditTransaction,
	draftOf,
	draftTotal,
	emptyLine,
	type TransactionDraft,
	toTransactionInput,
	writableAccounts,
} from "@/features/transactions/transaction-form";

const NOW = "2026-11-14T12:00:00.000Z";

const line = (amount: string, tagId = "") => ({
	...emptyLine(),
	amount,
	tagId,
});

function draft(fields: Partial<TransactionDraft> = {}): TransactionDraft {
	return {
		type: "expense",
		accountId: "chequing",
		toAccountId: "",
		date: "2026-11-14",
		payee: "",
		note: "",
		lines: [line("72", "gas")],
		...fields,
	};
}

const read = (fields?: Partial<TransactionDraft>, locale = "en") =>
	toTransactionInput(draft(fields), "CAD", locale);

describe("toTransactionInput", () => {
	it("reads an expense: its amount in minor units, its tag, trimmed texts", () => {
		expect(read({ payee: " Shell ", note: " Full tank " })).toEqual({
			ok: true,
			input: {
				type: "expense",
				accountId: "chequing",
				date: "2026-11-14",
				payee: "Shell",
				note: "Full tank",
				lines: [{ amount: 7200, tagId: "gas" }],
			},
		});
	});

	it("reads amounts in the user's language, and empty texts as none", () => {
		expect(read({ lines: [line("1 250,50")] }, "fr")).toMatchObject({
			ok: true,
			input: {
				payee: null,
				note: null,
				lines: [{ amount: 125_050, tagId: null }],
			},
		});
	});

	it("reads a split income line by line", () => {
		expect(
			read({ type: "income", lines: [line("100", "salary"), line("20.5")] }),
		).toMatchObject({
			ok: true,
			input: {
				type: "income",
				lines: [
					{ amount: 10_000, tagId: "salary" },
					{ amount: 2050, tagId: null },
				],
			},
		});
	});

	it("reads a transfer: the first amount, the two accounts, no payee nor lines", () => {
		expect(
			read({
				type: "transfer",
				toAccountId: "savings",
				payee: "ignored",
				lines: [line("300", "ignored")],
			}),
		).toEqual({
			ok: true,
			input: {
				type: "transfer",
				accountId: "chequing",
				toAccountId: "savings",
				date: "2026-11-14",
				note: null,
				amount: 30_000,
			},
		});
	});

	it("says which amounts can't be read, or aren't positive, line by line", () => {
		expect(
			read({
				lines: [line("72"), line(""), line("0"), line("-5"), line("abc")],
			}),
		).toEqual({
			ok: false,
			errors: {
				"lines.1.amount": "amount_invalid",
				"lines.2.amount": "amount_not_positive",
				"lines.3.amount": "amount_not_positive",
				"lines.4.amount": "amount_invalid",
			},
		});
	});

	it("asks for an account and a date", () => {
		expect(read({ accountId: "", date: "" })).toEqual({
			ok: false,
			errors: {
				accountId: "transaction_account_required",
				date: "date_invalid",
			},
		});
	});

	it("asks for the amount and the destination of a transfer", () => {
		expect(read({ type: "transfer", lines: [line("")] })).toEqual({
			ok: false,
			errors: {
				"lines.0.amount": "amount_invalid",
				toAccountId: "transaction_account_required",
			},
		});
	});
});

describe("draftOf", () => {
	const transaction: Transaction = {
		id: "t",
		householdId: "h",
		type: "expense",
		date: "2026-11-14",
		accountId: "chequing",
		toAccountId: null,
		amount: 18_000,
		payee: "Costco",
		note: null,
		origin: "manual",
		lines: [
			{ id: "a", amount: 12_000, tagId: "food" },
			{ id: "b", amount: 6000, tagId: null },
		],
		createdBy: null,
		createdAt: NOW,
		updatedAt: NOW,
	};

	it("fills the form with a transaction, amounts written in the user's language", () => {
		expect(draftOf(transaction, "CAD", "fr")).toMatchObject({
			type: "expense",
			accountId: "chequing",
			toAccountId: "",
			date: "2026-11-14",
			payee: "Costco",
			note: "",
			lines: [
				{ amount: "120,00", tagId: "food" },
				{ amount: "60,00", tagId: "" },
			],
		});
	});

	it("fills the form with a transfer: one amount, the destination", () => {
		expect(
			draftOf(
				{ ...transaction, type: "transfer", toAccountId: "savings", lines: [] },
				"CAD",
				"en",
			),
		).toMatchObject({
			type: "transfer",
			toAccountId: "savings",
			lines: [{ amount: "180.00", tagId: "" }],
		});
	});

	it("is read back as the same transaction", () => {
		const result = toTransactionInput(
			draftOf(transaction, "CAD", "fr"),
			"CAD",
			"fr",
		);

		expect(result).toMatchObject({
			ok: true,
			input: {
				type: "expense",
				payee: "Costco",
				lines: [
					{ amount: 12_000, tagId: "food" },
					{ amount: 6000, tagId: null },
				],
			},
		});
	});

	it("gives each line its own key", () => {
		const { lines } = draftOf(transaction, "CAD", "en");

		expect(new Set(lines.map((each) => each.key)).size).toBe(2);
	});
});

describe("draftTotal", () => {
	it("adds up the lines", () => {
		expect(
			draftTotal([line("120"), line("45.50"), line("15")], "CAD", "en"),
		).toBe(18_050);
	});

	it("is unknown while a line can't be read", () => {
		expect(draftTotal([line("120"), line("")], "CAD", "en")).toBeNull();
	});
});

describe("who may record and change transactions", () => {
	const account = (id: string, isHolder: boolean, archived = false) =>
		({ id, isHolder, archived }) as Account;
	const accounts = [
		account("mine", true),
		account("archived", true, true),
		account("bobs", false),
	];
	const on = (accountId: string) => ({ accountId }) as Transaction;

	it("offers the accounts the user holds that aren't archived", () => {
		expect(writableAccounts(accounts).map((each) => each.id)).toEqual(["mine"]);
	});

	it("lets the user change the transactions of those accounts only", () => {
		expect(canEditTransaction(on("mine"), accounts)).toBe(true);
		expect(canEditTransaction(on("archived"), accounts)).toBe(false);
		expect(canEditTransaction(on("bobs"), accounts)).toBe(false);
		expect(canEditTransaction(on("hidden"), accounts)).toBe(false);
	});
});
