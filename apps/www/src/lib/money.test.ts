import { describe, expect, it } from "vitest";
import { formatAmount } from "@/lib/money";

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
});
