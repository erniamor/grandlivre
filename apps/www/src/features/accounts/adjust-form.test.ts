import { describe, expect, it } from "vitest";
import {
	adjustmentGap,
	toAdjustInput,
	typedBalance,
} from "@/features/accounts/adjust-form";

describe("typedBalance", () => {
	it("reads the amount in the user's language, a debt as money owed", () => {
		expect(typedBalance("150,50", "cash", "CAD", "fr")).toBe(15_050);
		expect(typedBalance("520", "credit_card", "CAD", "en")).toBe(-52_000);
		expect(typedBalance("", "cash", "CAD", "en")).toBeNull();
		expect(typedBalance("abc", "cash", "CAD", "en")).toBeNull();
	});
});

describe("adjustmentGap", () => {
	it("is negative for what was spent and not noted, positive for more", () => {
		expect(adjustmentGap(27_000, 15_000)).toBe(-12_000);
		expect(adjustmentGap(10_000, 12_500)).toBe(2_500);
		expect(adjustmentGap(-50_000, -52_000)).toBe(-2_000);
	});
});

describe("toAdjustInput", () => {
	it("sends the balance, the day and the tag chosen", () => {
		expect(
			toAdjustInput(
				{ balance: "150", date: "2026-11-15", tagId: "outings" },
				"cash",
				"CAD",
				"en",
			),
		).toEqual({
			ok: true,
			input: { balance: 15_000, date: "2026-11-15", tagId: "outings" },
		});
		expect(
			toAdjustInput(
				{ balance: "0", date: "2026-11-15", tagId: "" },
				"cash",
				"CAD",
				"en",
			),
		).toEqual({ ok: true, input: { balance: 0, date: "2026-11-15" } });
	});

	it("says what can't be read", () => {
		expect(
			toAdjustInput({ balance: "", date: "", tagId: "" }, "cash", "CAD", "en"),
		).toEqual({
			ok: false,
			errors: { balance: "amount_invalid", date: "date_invalid" },
		});
	});
});
