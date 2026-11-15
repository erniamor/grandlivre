import { describe, expect, it } from "vitest";
import {
	parseDraftAmount,
	parsePrintedAmount,
} from "@/routes/drafts/draft-amounts";

describe("parseDraftAmount", () => {
	it("reads an amount into minor units", () => {
		expect(parseDraftAmount("72.40", "CAD")).toBe(7240);
		expect(parseDraftAmount("72", "CAD")).toBe(7200);
		expect(parseDraftAmount("72.4", "CAD")).toBe(7240);
		expect(parseDraftAmount("72,40", "CAD")).toBe(7240);
		expect(parseDraftAmount("1250", "JPY")).toBe(1250);
	});

	it("refuses what isn't a positive amount of the currency", () => {
		for (const text of [
			"",
			"abc",
			"-5",
			"0",
			"0.00",
			"72.405",
			"1,250.40",
			"$72",
		]) {
			expect(parseDraftAmount(text, "CAD")).toBeNull();
		}
		expect(parseDraftAmount("12.5", "JPY")).toBeNull();
	});
});

describe("parsePrintedAmount", () => {
	it("reads a price, a discount and a nil amount", () => {
		expect(parsePrintedAmount("12.99", "CAD")).toBe(1299);
		expect(parsePrintedAmount("-2.00", "CAD")).toBe(-200);
		expect(parsePrintedAmount(" -0,50 ", "CAD")).toBe(-50);
		expect(parsePrintedAmount("0.00", "CAD")).toBe(0);
	});

	it("refuses what isn't a printed amount", () => {
		for (const text of ["", "-", "abc", "1.999", "--2"]) {
			expect(parsePrintedAmount(text, "CAD")).toBeNull();
		}
	});
});
