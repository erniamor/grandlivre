import { describe, expect, it } from "vitest";
import {
	budgetProgress,
	byRisk,
	monthlyTotal,
	shiftMonth,
} from "@/features/budgets/budget-view";

describe("budgetProgress", () => {
	it("tells under, near, over with what is planned, and over", () => {
		const state = (spent: number, upcoming = 0) =>
			budgetProgress({ amount: 10_000, spent, upcoming }).state;

		expect(state(5_000)).toBe("under");
		expect(state(8_000)).toBe("near");
		expect(state(5_000, 6_000)).toBe("planned_over");
		expect(state(10_000)).toBe("near");
		expect(state(10_001)).toBe("over");
	});

	it("draws what is spent then what is planned, never past the end", () => {
		expect(
			budgetProgress({ amount: 10_000, spent: 2_500, upcoming: 5_000 }),
		).toEqual({
			left: 7_500,
			spentShare: 0.25,
			plannedShare: 0.5,
			state: "under",
		});
		expect(
			budgetProgress({ amount: 10_000, spent: 8_000, upcoming: 5_000 }),
		).toMatchObject({ spentShare: 0.8, plannedShare: expect.closeTo(0.2) });
		expect(
			budgetProgress({ amount: 10_000, spent: 12_000, upcoming: 0 }),
		).toMatchObject({ left: -2_000, spentShare: 1, plannedShare: 0 });
	});
});

describe("monthlyTotal", () => {
	it("adds up the monthly budgets, not the yearly ones", () => {
		const budget = (
			period: "month" | "year",
			amount: number,
			spent: number,
		) => ({
			tagId: "t",
			period,
			amount,
			since: "2026-01",
			spent,
			upcoming: 100,
		});

		const tag = (id: string, parentId: string | null = null) => ({
			id,
			parentId,
		});

		expect(
			monthlyTotal(
				[
					{ ...budget("month", 50_000, 10_000), tagId: "food" },
					{ ...budget("month", 20_000, 5_000), tagId: "home" },
					{ ...budget("year", 120_000, 60_000), tagId: "insurance" },
				],
				[tag("food"), tag("home"), tag("insurance")],
			),
		).toEqual({ amount: 70_000, spent: 15_000, upcoming: 200 });
		expect(monthlyTotal([budget("year", 1, 1)], [])).toBeNull();
	});

	it("counts a budget under a budgeted tag once, in its parent's", () => {
		const tags = [
			{ id: "food", parentId: null },
			{ id: "eating-out", parentId: "food" },
			{ id: "restaurants", parentId: "eating-out" },
		];
		const budget = (tagId: string, amount: number, spent: number) => ({
			tagId,
			period: "month" as const,
			amount,
			since: "2026-11",
			spent,
			upcoming: 0,
		});

		expect(
			monthlyTotal(
				[budget("food", 50_000, 14_000), budget("restaurants", 2_000, 3_000)],
				tags,
			),
		).toEqual({ amount: 50_000, spent: 14_000, upcoming: 0 });
	});
});

describe("shiftMonth", () => {
	it("moves across years", () => {
		expect(shiftMonth("2026-11", 1)).toBe("2026-12");
		expect(shiftMonth("2026-12", 1)).toBe("2027-01");
		expect(shiftMonth("2026-01", -1)).toBe("2025-12");
	});
});

describe("byRisk", () => {
	it("puts the budgets the closest to their end first", () => {
		const budget = (tagId: string, spent: number, upcoming = 0) => ({
			tagId,
			period: "month" as const,
			amount: 10_000,
			since: "2026-01",
			spent,
			upcoming,
		});

		expect(
			byRisk([
				budget("calm", 1_000),
				budget("near", 8_500),
				budget("over", 11_000),
				budget("half", 5_000),
				budget("planned", 6_000, 5_000),
				budget("far over", 15_000),
			]).map((each) => each.tagId),
		).toEqual(["far over", "over", "planned", "near", "half", "calm"]);
	});
});
