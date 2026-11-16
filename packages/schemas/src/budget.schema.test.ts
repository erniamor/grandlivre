import { describe, expect, it } from "vitest";
import { monthSchema, setBudgetSchema } from "./budget.schema";

describe("setBudgetSchema", () => {
	it("accepts a monthly or yearly amount from a month on", () => {
		for (const period of ["month", "year"]) {
			const budget = { period, amount: 50_000, from: "2026-11" };
			expect(setBudgetSchema.parse(budget)).toEqual(budget);
		}
	});

	it("rejects an amount that isn't positive, and an unknown field", () => {
		expect(
			setBudgetSchema.safeParse({ period: "month", amount: 0, from: "2026-11" })
				.error?.issues[0]?.message,
		).toBe("amount_not_positive");
		expect(
			setBudgetSchema.safeParse({
				period: "month",
				amount: 1,
				from: "2026-11",
				tagId: "x",
			}).success,
		).toBe(false);
	});
});

describe("monthSchema", () => {
	it("takes a calendar month only", () => {
		expect(monthSchema.safeParse("2026-11").success).toBe(true);
		for (const month of ["2026-13", "2026-00", "2026-1", "2026-11-01", "nov"]) {
			expect(monthSchema.safeParse(month).error?.issues[0]?.message).toBe(
				"budget_month_invalid",
			);
		}
	});
});
