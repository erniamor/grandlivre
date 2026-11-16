import { describe, expect, it } from "vitest";
import {
	budgetFormState,
	toSetBudgetInput,
} from "@/features/budgets/budget-form";

describe("budgetFormState", () => {
	it("starts from the budget in force, from the month shown", () => {
		expect(
			budgetFormState("2026-11", "CAD", "fr", {
				budget: {
					tagId: "food",
					period: "year",
					amount: 120_000,
					since: "2026-01",
					spent: 0,
					upcoming: 0,
				},
			}),
		).toEqual({
			tagId: "food",
			period: "year",
			amount: "1200,00",
			from: "2026-11",
		});
		expect(budgetFormState("2026-11", "CAD", "en", { tagId: "food" })).toEqual({
			tagId: "food",
			period: "month",
			amount: "",
			from: "2026-11",
		});
	});
});

describe("toSetBudgetInput", () => {
	it("reads the amount in the user's language", () => {
		expect(
			toSetBudgetInput(
				{ tagId: "food", period: "month", amount: "1 500,50", from: "2026-11" },
				"CAD",
				"fr",
			),
		).toEqual({
			ok: true,
			tagId: "food",
			input: { period: "month", amount: 150_050, from: "2026-11" },
		});
	});

	it("says what is missing or wrong", () => {
		expect(
			toSetBudgetInput(
				{ tagId: "", period: "month", amount: "0", from: "" },
				"CAD",
				"en",
			),
		).toEqual({
			ok: false,
			errors: {
				tagId: "budget_tag_required",
				amount: "amount_not_positive",
				from: "budget_month_invalid",
			},
		});
		expect(
			toSetBudgetInput(
				{ tagId: "food", period: "month", amount: "abc", from: "2026-11" },
				"CAD",
				"en",
			),
		).toMatchObject({ errors: { amount: "amount_invalid" } });
	});
});
