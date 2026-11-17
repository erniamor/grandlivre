import type { RecurringSuggestion } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import {
	findSuggestion,
	recurringStateOfSuggestion,
	suggestionId,
} from "@/features/recurring/recurring-suggestion";

const pay: RecurringSuggestion = {
	accountId: "chequing",
	toAccountId: null,
	type: "income",
	key: "atelierborealinc",
	payee: "ATELIER BOREAL INC.",
	unit: "month",
	interval: 1,
	amount: 2_875_40,
	minAmount: 2_875_40,
	maxAmount: 2_875_40,
	mode: "automatic",
	nextDate: "2026-11-30",
	tagId: null,
	count: 8,
	dates: ["2026-10-30"],
};

describe("findSuggestion", () => {
	it("tells apart two series of a payee by their days", () => {
		const fifteenth = { ...pay, nextDate: "2026-12-15" };

		expect(findSuggestion([pay, fifteenth], suggestionId(fifteenth))).toBe(
			fifteenth,
		);
		expect(findSuggestion([pay], suggestionId(fifteenth))).toBeUndefined();
	});
});

describe("recurringStateOfSuggestion", () => {
	it("fills a transfer with its two accounts and its amount", () => {
		const saving: RecurringSuggestion = {
			...pay,
			type: "transfer",
			toAccountId: "savings",
			key: "",
			payee: null,
			amount: 200_00,
			unit: "week",
			interval: 2,
		};

		const state = recurringStateOfSuggestion(saving, "CAD", "fr");

		expect(state).toMatchObject({
			transaction: {
				type: "transfer",
				accountId: "chequing",
				toAccountId: "savings",
				payee: "",
				lines: [{ amount: "200,00", tagId: "" }],
			},
			schedule: { unit: "week", interval: "2", startDate: "2026-11-30" },
			mode: "automatic",
		});
	});
});
