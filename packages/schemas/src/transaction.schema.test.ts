import { describe, expect, it } from "vitest";
import {
	createTransactionSchema,
	TRANSACTION_MAX_LINES,
	TRANSACTION_NOTE_MAX_LENGTH,
	TRANSACTION_PAYEE_MAX_LENGTH,
	updateTransactionSchema,
} from "./transaction.schema";

function issues(result: {
	error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
	return (
		result.error?.issues.map((issue) => [
			issue.path.join("."),
			issue.message,
		]) ?? []
	);
}

const ACCOUNT = "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f";
const OTHER_ACCOUNT = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const TAG = "9c8b7a6d-5e4f-4d3c-a2b1-0f9e8d7c6b5a";

const expense = {
	type: "expense",
	accountId: ACCOUNT,
	date: "2026-11-14",
	lines: [{ amount: 7200, tagId: TAG }],
};

const transfer = {
	type: "transfer",
	accountId: ACCOUNT,
	toAccountId: OTHER_ACCOUNT,
	date: "2026-11-14",
	amount: 50_000,
};

describe("createTransactionSchema", () => {
	it("accepts an expense with one line, a payee and a note, trimmed", () => {
		expect(
			createTransactionSchema.parse({
				...expense,
				payee: "  Shell ",
				note: " Full tank ",
			}),
		).toEqual({ ...expense, payee: "Shell", note: "Full tank" });
	});

	it("accepts an income, and a line without a tag", () => {
		const income = {
			type: "income",
			accountId: ACCOUNT,
			date: "2026-11-01",
			lines: [{ amount: 250_000 }, { amount: 1000, tagId: null }],
		};

		expect(createTransactionSchema.parse(income)).toEqual(income);
	});

	it("accepts an expense split into several lines", () => {
		const split = {
			...expense,
			payee: "Costco",
			lines: [
				{ amount: 12_000, tagId: TAG },
				{ amount: 4500, tagId: null },
				{ amount: 1500 },
			],
		};

		expect(createTransactionSchema.parse(split)).toEqual(split);
	});

	it("accepts a transfer between two accounts", () => {
		expect(createTransactionSchema.parse(transfer)).toEqual(transfer);
	});

	it("accepts where the transaction comes from", () => {
		const imported = { ...expense, origin: "import" };

		expect(createTransactionSchema.parse(imported)).toEqual(imported);
	});

	it("rejects an expense without lines, or with too many", () => {
		expect(
			issues(createTransactionSchema.safeParse({ ...expense, lines: [] })),
		).toEqual([["lines", "transaction_lines_required"]]);
		expect(
			issues(
				createTransactionSchema.safeParse({
					...expense,
					lines: Array.from({ length: TRANSACTION_MAX_LINES + 1 }, () => ({
						amount: 100,
					})),
				}),
			),
		).toEqual([["lines", "transaction_lines_too_many"]]);
	});

	it("rejects an amount that isn't a positive integer, on the line concerned", () => {
		expect(
			issues(
				createTransactionSchema.safeParse({
					...expense,
					lines: [
						{ amount: 100 },
						{ amount: 0 },
						{ amount: -5 },
						{ amount: 1.5 },
					],
				}),
			),
		).toEqual([
			["lines.1.amount", "amount_not_positive"],
			["lines.2.amount", "amount_not_positive"],
			["lines.3.amount", "amount_invalid"],
		]);
		expect(
			issues(createTransactionSchema.safeParse({ ...transfer, amount: 0 })),
		).toEqual([["amount", "amount_not_positive"]]);
	});

	it("rejects a date that isn't a calendar day", () => {
		for (const date of [
			"2026-02-30",
			"14/11/2026",
			"2026-11-14T10:00:00Z",
			"",
		]) {
			expect(
				issues(createTransactionSchema.safeParse({ ...expense, date })),
			).toEqual([["date", "date_invalid"]]);
		}
	});

	it("rejects a transfer to the same account", () => {
		expect(
			issues(
				createTransactionSchema.safeParse({
					...transfer,
					toAccountId: ACCOUNT,
				}),
			),
		).toEqual([["toAccountId", "transfer_same_account"]]);
	});

	it("keeps the details of a receipt with an expense, not with a transfer", () => {
		const receipt = {
			merchant: " IGA ",
			items: [
				{ name: "Apples", amount: 600 },
				{ name: "Coupon", amount: -100 },
			],
			subtotal: 500,
			taxes: [{ name: "TPS", amount: 25 }],
			total: 525,
		};

		expect(
			createTransactionSchema.parse({ ...expense, origin: "receipt", receipt }),
		).toMatchObject({ receipt: { ...receipt, merchant: "IGA" } });
		expect(
			issues(
				createTransactionSchema.safeParse({
					...expense,
					receipt: { ...receipt, total: 0 },
				}),
			),
		).toEqual([["receipt.total", "amount_not_positive"]]);
		expect(
			createTransactionSchema.safeParse({ ...transfer, receipt }).success,
		).toBe(false);
	});

	it("keeps the origins of the API's own to the API", () => {
		for (const origin of ["recurring", "adjustment"]) {
			expect(
				createTransactionSchema.safeParse({ ...expense, origin }).success,
			).toBe(false);
		}
	});

	it("keeps each type to its own fields", () => {
		// A transfer has no lines, an expense no destination
		expect(
			createTransactionSchema.safeParse({ ...transfer, lines: expense.lines })
				.success,
		).toBe(false);
		expect(
			createTransactionSchema.safeParse({
				...expense,
				toAccountId: OTHER_ACCOUNT,
			}).success,
		).toBe(false);
		expect(
			createTransactionSchema.safeParse({ ...expense, amount: 7200 }).success,
		).toBe(false);
	});

	it("rejects an unknown type, and texts that are too long", () => {
		expect(
			issues(createTransactionSchema.safeParse({ ...expense, type: "refund" })),
		).toEqual([["type", "transaction_type_invalid"]]);
		expect(
			issues(
				createTransactionSchema.safeParse({
					...expense,
					payee: "a".repeat(TRANSACTION_PAYEE_MAX_LENGTH + 1),
					note: "a".repeat(TRANSACTION_NOTE_MAX_LENGTH + 1),
				}),
			),
		).toEqual([
			["note", "transaction_note_too_long"],
			["payee", "transaction_payee_too_long"],
		]);
	});

	it("rejects identifiers that aren't ids, with a code per field", () => {
		expect(
			issues(
				createTransactionSchema.safeParse({
					...expense,
					accountId: "chequing",
					lines: [{ amount: 100, tagId: "gas" }],
				}),
			),
		).toEqual([
			["accountId", "transaction_account_invalid"],
			["lines.0.tagId", "transaction_tag_invalid"],
		]);
	});
});

describe("updateTransactionSchema", () => {
	it("accepts a whole transaction, of any type", () => {
		expect(updateTransactionSchema.parse(expense)).toEqual(expense);
		expect(updateTransactionSchema.parse(transfer)).toEqual(transfer);
	});

	it("applies the same rules as a creation", () => {
		expect(
			issues(updateTransactionSchema.safeParse({ ...expense, lines: [] })),
		).toEqual([["lines", "transaction_lines_required"]]);
		expect(
			issues(
				updateTransactionSchema.safeParse({
					...transfer,
					toAccountId: ACCOUNT,
				}),
			),
		).toEqual([["toAccountId", "transfer_same_account"]]);
	});

	it("can't change where the transaction comes from", () => {
		expect(
			updateTransactionSchema.safeParse({ ...expense, origin: "import" })
				.success,
		).toBe(false);
	});
});
