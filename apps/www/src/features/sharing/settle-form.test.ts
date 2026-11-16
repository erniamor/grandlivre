import { describe, expect, it } from "vitest";
import { toSettlementInput } from "@/features/sharing/settle-form";

const state = {
	fromUserId: "bob",
	toUserId: "alice",
	amount: "60,00",
	date: "2026-11-15",
	note: " Interac ",
	transfer: false,
	fromAccountId: "",
	toAccountId: "",
};

describe("toSettlementInput", () => {
	it("reads a payment outside the accounts, or with its transfer", () => {
		expect(toSettlementInput(state, "CAD", "fr")).toEqual({
			ok: true,
			input: {
				fromUserId: "bob",
				toUserId: "alice",
				amount: 6_000,
				date: "2026-11-15",
				note: "Interac",
			},
		});
		expect(
			toSettlementInput(
				{ ...state, transfer: true, fromAccountId: "b", toAccountId: "a" },
				"CAD",
				"fr",
			),
		).toMatchObject({
			input: { transfer: { fromAccountId: "b", toAccountId: "a" } },
		});
	});

	it("says what is wrong", () => {
		expect(
			toSettlementInput(
				{ ...state, toUserId: "bob", amount: "0", transfer: true },
				"CAD",
				"en",
			),
		).toEqual({
			ok: false,
			errors: {
				toUserId: "settlement_same_member",
				amount: "amount_not_positive",
				"transfer.fromAccountId": "transaction_account_required",
				"transfer.toAccountId": "transaction_account_required",
			},
		});
	});
});
