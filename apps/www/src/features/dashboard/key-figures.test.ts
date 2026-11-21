import { describe, expect, it } from "vitest";
import { keyFigures, monthToDate } from "@/features/dashboard/key-figures";
import type { ReportView } from "@/features/reports/report-tree";

const view = (expenses: number, incomes: number): ReportView => ({
	expenses: { total: expenses, nodes: [], uncategorized: 0, undetermined: 0 },
	incomes: { total: incomes, nodes: [], uncategorized: 0, undetermined: 0 },
	balance: incomes - expenses,
	isEmpty: expenses === 0 && incomes === 0,
});

describe("monthToDate", () => {
	it("compares this month with last month up to the same day", () => {
		expect(monthToDate("2026-11-17")).toEqual({
			current: { from: "2026-11-01", to: "2026-11-17" },
			previous: { from: "2026-10-01", to: "2026-10-17" },
		});
	});

	it("stops at the end of a shorter month, and goes back across a year", () => {
		expect(monthToDate("2026-03-31").previous).toEqual({
			from: "2026-02-01",
			to: "2026-02-28",
		});
		expect(monthToDate("2027-01-05").previous).toEqual({
			from: "2026-12-01",
			to: "2026-12-05",
		});
	});
});

describe("keyFigures", () => {
	it("gives the savings, their rate, and how the expenses compare", () => {
		expect(
			keyFigures(view(3_210_00, 6_400_00), view(2_972_22, 6_000_00)),
		).toEqual({
			expenses: 3_210_00,
			incomes: 6_400_00,
			savings: 3_190_00,
			savingsRate: 3_190_00 / 6_400_00,
			expensesChange: 3_210_00 / 2_972_22 - 1,
		});
	});

	it("has no rate without incomes, nor a comparison without expenses last month", () => {
		expect(keyFigures(view(500_00, 0), view(0, 0))).toMatchObject({
			savings: -500_00,
			savingsRate: null,
			expensesChange: null,
		});
	});
});
