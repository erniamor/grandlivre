import { describe, expect, it } from "vitest";
import { pairTransfers } from "@/routes/imports/in-file-pairs";
import {
	payeeHabits,
	suggestFromHabits,
} from "@/routes/imports/payee-suggestions";
import { addDays, matchLines } from "@/routes/imports/statement-matching";
import { desjardinsTransferHint } from "@/routes/imports/statements/desjardins";

describe("matchLines", () => {
	const candidate = (ref: string, date: string, amount: number, rank = 0) => ({
		ref,
		date,
		amount,
		rank,
	});

	it("ties a line to a transaction of the same amount, from 5 days before to 3 days after", () => {
		const lines = [
			{ date: "2026-10-10", amount: -60_50 },
			{ date: "2026-10-10", amount: -12_00 },
			{ date: "2026-10-10", amount: -8_00 },
		];

		const matched = matchLines(lines, [
			// Noted 5 days before the bank posted it
			candidate("fuel", "2026-10-05", -60_50),
			// 6 days before: too far
			candidate("lunch", "2026-10-04", -12_00),
			// Noted 3 days after
			candidate("coffee", "2026-10-13", -8_00),
		]);

		expect(Object.fromEntries(matched)).toEqual({ 0: "fuel", 2: "coffee" });
		expect(
			matchLines(lines, [candidate("late", "2026-10-14", -8_00)]).size,
		).toBe(0);
	});

	it("never ties an amount the other way", () => {
		expect(
			matchLines(
				[{ date: "2026-10-10", amount: 60_50 }],
				[candidate("fuel", "2026-10-10", -60_50)],
			).size,
		).toBe(0);
	});

	it("ties each to one at most, the closest days first", () => {
		const matched = matchLines(
			[
				{ date: "2026-10-10", amount: -5_00 },
				{ date: "2026-10-12", amount: -5_00 },
			],
			[
				candidate("monday", "2026-10-09", -5_00),
				candidate("wednesday", "2026-10-12", -5_00),
				candidate("extra", "2026-10-11", -5_00),
			],
		);

		expect(Object.fromEntries(matched)).toEqual({
			0: "monday",
			1: "wednesday",
		});
	});

	it("prefers a transaction to a recurring day at the same distance", () => {
		const matched = matchLines(
			[{ date: "2026-10-01", amount: -1_500_00 }],
			[
				candidate("day", "2026-10-01", -1_500_00, 1),
				candidate("recorded", "2026-10-01", -1_500_00, 0),
			],
		);

		expect(matched.get(0)).toBe("recorded");
	});

	it("counts days across months", () => {
		expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
		expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
	});
});

describe("payeeHabits and suggestFromHabits", () => {
	const habits = payeeHabits([
		// Most recent first: the last time wins
		{
			payee: "Costco",
			type: "expense",
			accountId: "card",
			toAccountId: null,
			tagIds: ["groceries"],
		},
		{
			payee: "COSTCO",
			type: "expense",
			accountId: "card",
			toAccountId: null,
			tagIds: ["home"],
		},
		{
			payee: "Pharmacie",
			type: "expense",
			accountId: "card",
			toAccountId: null,
			tagIds: ["health", "beauty"],
		},
		{
			payee: "Remises Visa",
			type: "transfer",
			accountId: "chequing",
			toAccountId: "card",
			tagIds: [],
		},
		{
			payee: "Rody",
			type: "expense",
			accountId: "chequing",
			toAccountId: null,
			tagIds: [null],
		},
	]);

	it("suggests the tag a payee had the last time, or a longer name's", () => {
		expect(suggestFromHabits(habits, "COSTCO", null)).toEqual({
			kind: "tag",
			tagId: "groceries",
		});
		expect(suggestFromHabits(habits, "COSTCO ESSENCE W100", "card")).toEqual({
			kind: "tag",
			tagId: "groceries",
		});
	});

	it("suggests nothing for several tags, no tag, or a payee never seen", () => {
		expect(suggestFromHabits(habits, "Pharmacie", null)).toBeNull();
		expect(suggestFromHabits(habits, "Rody", null)).toBeNull();
		expect(suggestFromHabits(habits, "SAAQ", null)).toBeNull();
	});

	it("suggests a transfer on one of its accounts, to the other", () => {
		expect(suggestFromHabits(habits, "Remises Visa", "chequing")).toEqual({
			kind: "transfer",
			accountId: "card",
		});
		expect(suggestFromHabits(habits, "Remises Visa", "card")).toEqual({
			kind: "transfer",
			accountId: "chequing",
		});
		expect(suggestFromHabits(habits, "Remises Visa", "savings")).toBeNull();
	});
});

describe("desjardinsTransferHint", () => {
	const account = "desjardins:caisseduplateau:123456:EOP";

	it("names another account of the branch, to or from", () => {
		expect(
			desjardinsTransferHint(
				account,
				"Virement - AccèsD Internet /à 654321 EOP",
			),
		).toEqual({
			kind: "account",
			number: "desjardins:caisseduplateau:654321:EOP",
		});
		expect(
			desjardinsTransferHint(
				account,
				"Virement - AccesD Internet /de 0654321-ES",
			),
		).toEqual({
			kind: "account",
			number: "desjardins:caisseduplateau:654321:ES",
		});
	});

	it("names a bill paid, and cash taken out", () => {
		expect(
			desjardinsTransferHint(
				account,
				"Paiement facture - AccèsD Internet /Remises Visa Desjardins",
			),
		).toEqual({ kind: "card", name: "Remises Visa Desjardins" });
		expect(
			desjardinsTransferHint(account, "Retrait au GA /CD PLATEAU"),
		).toEqual({ kind: "cash" });
	});

	it("names a card paid from an account, and nothing else", () => {
		const card = "desjardins-card:remisesvisa:1234";

		expect(desjardinsTransferHint(card, "PAIEMENT CAISSE")).toEqual({
			kind: "payment",
		});
		expect(
			desjardinsTransferHint(card, "PAIEMENT CAISSE - MERCI BRANCH PAYMENT"),
		).toEqual({ kind: "payment" });
		expect(desjardinsTransferHint(card, "CAFE EXEMPLE")).toBeNull();
		expect(desjardinsTransferHint(account, "Achat /CAFE")).toBeNull();
	});
});

describe("pairTransfers", () => {
	const line = (
		index: number,
		externalId: string,
		date: string,
		amount: number,
		otherIndex: number | null,
	) => ({ index, externalId, date, amount, otherIndex });

	it("pairs a transfer seen from both accounts of the file", () => {
		const pairs = pairTransfers([
			line(0, "out", "2026-10-15", -300_00, 1),
			line(1, "in", "2026-10-15", 300_00, 0),
			line(1, "other", "2026-10-15", 300_00, null),
		]);

		expect(pairs.get("0:out")).toEqual({ index: 1, externalId: "in" });
		expect(pairs.get("1:in")).toEqual({ index: 0, externalId: "out" });
		expect(pairs.has("1:other")).toBe(false);
	});

	it("pairs once, the closest day first, and not too far apart", () => {
		const pairs = pairTransfers([
			line(0, "out", "2026-10-15", -300_00, 1),
			line(1, "far", "2026-10-19", 300_00, null),
			line(1, "near", "2026-10-16", 300_00, null),
			line(1, "next", "2026-10-15", 300_00, null),
		]);

		expect(pairs.get("0:out")).toEqual({ index: 1, externalId: "next" });
		expect(pairs.size).toBe(2);
		expect(
			pairTransfers([
				line(0, "out", "2026-10-15", -300_00, 1),
				line(1, "far", "2026-10-19", 300_00, null),
			]).size,
		).toBe(0);
	});
});
