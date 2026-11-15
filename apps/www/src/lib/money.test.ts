import { describe, expect, it } from "vitest";
import { formatAmount, formatAmountInput, parseAmount } from "@/lib/money";

/** Intl separates groups and symbols with non-breaking spaces. */
const plainSpaces = (text: string) => text.replace(/\s/g, " ");

describe("formatAmount", () => {
	it("formats minor units in the currency, the way the language writes it", () => {
		expect(formatAmount(125_050, "CAD", "en")).toBe("$1,250.50");
		expect(plainSpaces(formatAmount(125_050, "CAD", "fr"))).toBe("1 250,50 $");
		expect(plainSpaces(formatAmount(125_050, "EUR", "es"))).toBe("1250,50 €");
	});

	it("keeps the sign of money owed, and the cents of a round amount", () => {
		expect(formatAmount(-45_000, "CAD", "en")).toBe("-$450.00");
		expect(formatAmount(0, "CAD", "en")).toBe("$0.00");
	});

	it("follows the currency's own minor unit", () => {
		expect(formatAmount(1250, "JPY", "en")).toBe("¥1,250");
	});

	it("writes the sign of money coming in when asked", () => {
		const signed = { signed: true };

		expect(formatAmount(7200, "CAD", "en", signed)).toBe("+$72.00");
		expect(formatAmount(-7200, "CAD", "en", signed)).toBe("-$72.00");
		expect(formatAmount(0, "CAD", "en", signed)).toBe("$0.00");
		expect(plainSpaces(formatAmount(7200, "CAD", "fr", signed))).toBe(
			"+72,00 $",
		);
	});
});

describe("formatAmountInput", () => {
	it("writes the amount without symbol or grouping, in the language's format", () => {
		expect(formatAmountInput(125_050, "CAD", "en")).toBe("1250.50");
		expect(formatAmountInput(125_050, "CAD", "fr")).toBe("1250,50");
		expect(formatAmountInput(-45_000, "CAD", "en")).toBe("-450.00");
		expect(formatAmountInput(1250, "JPY", "en")).toBe("1250");
	});

	it("is read back by parseAmount", () => {
		for (const locale of ["en", "fr", "es"]) {
			for (const amount of [0, 5, 125_050, -45_000, 100_000_000]) {
				expect(
					parseAmount(formatAmountInput(amount, "CAD", locale), "CAD", locale),
				).toBe(amount);
			}
		}
	});
});

describe("parseAmount", () => {
	it.each([
		["1250.50", "en", 125_050],
		["1,250.50", "en", 125_050],
		["$1,250.50", "en", 125_050],
		["1250", "en", 125_000],
		["1,250", "en", 125_000],
		["1,234,567", "en", 123_456_700],
		["12.5", "en", 1250],
		["12,50", "en", 1250],
		[".5", "en", 50],
		["72 $", "fr", 7200],
		["1 250,50", "fr", 125_050],
		["1 250,50 $", "fr", 125_050],
		["1250,5", "fr", 125_050],
		["12.50", "fr", 1250],
		["1.250,50", "es", 125_050],
		["1.250", "es", 125_000],
		["1’250.50", "en", 125_050],
		["0", "en", 0],
	])("reads %j in %s", (text, locale, amount) => {
		expect(parseAmount(text, "CAD", locale)).toBe(amount);
	});

	it("reads a negative amount, with either minus sign", () => {
		expect(parseAmount("-450", "CAD", "en")).toBe(-45_000);
		expect(parseAmount("−450,00", "CAD", "fr")).toBe(-45_000);
		expect(parseAmount("-0", "CAD", "en")).toBe(0);
	});

	it("refuses more decimals than the currency has, in the language's reading", () => {
		// In French the comma separates decimals: this is 1.250, not 1250
		expect(parseAmount("1,250", "CAD", "fr")).toBeNull();
	});

	it("follows the currency's own minor unit", () => {
		expect(parseAmount("1250", "JPY", "en")).toBe(1250);
		expect(parseAmount("1,250", "JPY", "en")).toBe(1250);
		expect(parseAmount("12.5", "JPY", "en")).toBeNull();
	});

	it.each([
		"",
		"  ",
		"abc",
		"-",
		".",
		"12.345",
		"1.2.3,4,5.6",
		"12-5",
		"12,34,567",
		"1,2345.60",
	])("refuses %j", (text) => {
		expect(parseAmount(text, "CAD", "en")).toBeNull();
	});
});
