import type { Account } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import {
	canEditAccount,
	toBalanceText,
	toOpeningBalance,
} from "@/features/accounts/account-form";

describe("toOpeningBalance", () => {
	it("keeps the sign typed for an account that holds money", () => {
		expect(toOpeningBalance("1 250,50", "checking", "CAD", "fr")).toBe(125_050);
		expect(toOpeningBalance("-20", "checking", "CAD", "en")).toBe(-2000);
	});

	it("stores the amount owed on a credit card or a loan as a negative balance", () => {
		expect(toOpeningBalance("450", "credit_card", "CAD", "en")).toBe(-45_000);
		expect(toOpeningBalance("250000", "loan", "CAD", "en")).toBe(-25_000_000);
		// A card in credit: the bank owes the holder
		expect(toOpeningBalance("-50", "credit_card", "CAD", "en")).toBe(5000);
		expect(toOpeningBalance("0", "loan", "CAD", "en")).toBe(0);
	});

	it("is null for what isn't an amount", () => {
		expect(toOpeningBalance("", "checking", "CAD", "en")).toBeNull();
		expect(toOpeningBalance("abc", "loan", "CAD", "en")).toBeNull();
	});
});

describe("toBalanceText", () => {
	it("shows the balance as typed, and a debt as the amount owed", () => {
		expect(toBalanceText(125_050, "checking", "CAD", "fr")).toBe("1250,50");
		expect(toBalanceText(-45_000, "credit_card", "CAD", "en")).toBe("450.00");
		expect(toBalanceText(0, "loan", "CAD", "en")).toBe("0.00");
	});

	it("is read back by toOpeningBalance", () => {
		for (const type of ["checking", "credit_card"] as const) {
			for (const balance of [0, 125_050, -45_000]) {
				expect(
					toOpeningBalance(
						toBalanceText(balance, type, "CAD", "fr"),
						type,
						"CAD",
						"fr",
					),
				).toBe(balance);
			}
		}
	});
});

describe("canEditAccount", () => {
	const account = (holders: number, isHolder: boolean) =>
		({
			isHolder,
			holders: Array.from({ length: holders }, (_, index) => ({
				userId: String(index),
				name: "Someone",
			})),
		}) as Account;

	it("lets the holders change their account", () => {
		expect(canEditAccount(account(1, true), false)).toBe(true);
	});

	it("refuses the other members, even an owner of the household", () => {
		expect(canEditAccount(account(1, false), false)).toBe(false);
		expect(canEditAccount(account(1, false), true)).toBe(false);
	});

	it("lets an owner of the household take care of an account without a holder", () => {
		expect(canEditAccount(account(0, false), true)).toBe(true);
		expect(canEditAccount(account(0, false), false)).toBe(false);
	});
});
