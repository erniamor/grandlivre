import { describe, expect, it } from "vitest";
import {
	ACCOUNT_MAX_HOLDERS,
	ACCOUNT_NAME_MAX_LENGTH,
	createAccountSchema,
	updateAccountSchema,
} from "./account.schema";
import { amountSchema, MAX_AMOUNT } from "./common";

function messages(result: { error?: { issues: { message: string }[] } }) {
	return result.error?.issues.map((issue) => issue.message) ?? [];
}

const ALICE = "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f";
const BOB = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

const valid = {
	name: "Joint chequing",
	type: "checking",
	visibility: "details",
	openingBalance: 125_050,
};

describe("amountSchema", () => {
	it("accepts integers in minor units, negative included", () => {
		for (const amount of [0, 7250, -7250, MAX_AMOUNT, -MAX_AMOUNT]) {
			expect(amountSchema.parse(amount)).toBe(amount);
		}
	});

	it("rejects decimals and anything that isn't a number", () => {
		for (const amount of [72.5, "7250", null, Number.NaN]) {
			expect(messages(amountSchema.safeParse(amount))).toEqual([
				"amount_invalid",
			]);
		}
	});

	it("rejects amounts beyond the maximum", () => {
		for (const amount of [MAX_AMOUNT + 1, -MAX_AMOUNT - 1]) {
			expect(messages(amountSchema.safeParse(amount))).toEqual([
				"amount_too_large",
			]);
		}
	});
});

describe("createAccountSchema", () => {
	it("accepts an account, with its name trimmed", () => {
		expect(
			createAccountSchema.parse({ ...valid, name: "  Joint chequing " }),
		).toEqual(valid);
	});

	it("accepts holders, and a negative opening balance for money owed", () => {
		const account = {
			...valid,
			type: "credit_card",
			visibility: "balance",
			openingBalance: -45_000,
			holderIds: [ALICE, BOB],
		};

		expect(createAccountSchema.parse(account)).toEqual(account);
	});

	it("rejects a blank or too long name", () => {
		expect(
			messages(createAccountSchema.safeParse({ ...valid, name: " " })),
		).toEqual(["account_name_required"]);
		expect(
			messages(
				createAccountSchema.safeParse({
					...valid,
					name: "a".repeat(ACCOUNT_NAME_MAX_LENGTH + 1),
				}),
			),
		).toEqual(["account_name_too_long"]);
	});

	it("rejects an unknown type or visibility", () => {
		expect(
			messages(createAccountSchema.safeParse({ ...valid, type: "crypto" })),
		).toEqual(["account_type_invalid"]);
		expect(
			messages(
				createAccountSchema.safeParse({ ...valid, visibility: "hidden" }),
			),
		).toEqual(["account_visibility_invalid"]);
	});

	it("rejects an opening balance that isn't in minor units", () => {
		expect(
			messages(
				createAccountSchema.safeParse({ ...valid, openingBalance: 12.5 }),
			),
		).toEqual(["amount_invalid"]);
	});

	it("rejects an empty list of holders", () => {
		expect(
			messages(createAccountSchema.safeParse({ ...valid, holderIds: [] })),
		).toEqual(["account_holders_required"]);
	});

	it("rejects holders that aren't distinct user ids, or too many", () => {
		const tooMany = Array.from(
			{ length: ACCOUNT_MAX_HOLDERS + 1 },
			(_, index) =>
				`00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
		);

		for (const holderIds of [["alice"], [ALICE, ALICE], tooMany, "alice"]) {
			expect(
				messages(createAccountSchema.safeParse({ ...valid, holderIds })),
			).toEqual(["account_holders_invalid"]);
		}
	});

	it("rejects an unknown field", () => {
		expect(
			createAccountSchema.safeParse({ ...valid, balance: 10 }).success,
		).toBe(false);
	});
});

describe("updateAccountSchema", () => {
	it("accepts any subset of the fields", () => {
		expect(updateAccountSchema.parse({ visibility: "balance" })).toEqual({
			visibility: "balance",
		});
		expect(updateAccountSchema.parse({ holderIds: [ALICE] })).toEqual({
			holderIds: [ALICE],
		});
		expect(updateAccountSchema.parse({})).toEqual({});
	});

	it("still validates the fields it receives", () => {
		expect(messages(updateAccountSchema.safeParse({ name: " " }))).toEqual([
			"account_name_required",
		]);
		expect(messages(updateAccountSchema.safeParse({ holderIds: [] }))).toEqual([
			"account_holders_required",
		]);
	});
});
