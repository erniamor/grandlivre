import type { Tag } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import { expenseBreakdown } from "@/features/dashboard/expense-breakdown";
import type { ReportNode, ReportView } from "@/features/reports/report-tree";

const node = (id: string, amount: number): ReportNode => ({
	tag: { id } as Tag,
	name: id,
	amount,
	share: 0,
	children: [],
});

function view(nodes: ReportNode[], uncategorized = 0): ReportView {
	const total =
		nodes.reduce((sum, each) => sum + each.amount, 0) + uncategorized;
	return {
		expenses: { total, nodes, uncategorized },
		incomes: { total: 0, nodes: [], uncategorized: 0 },
		balance: -total,
		isEmpty: total === 0,
	};
}

describe("expenseBreakdown", () => {
	it("lists the tags at the top and the uncategorized lines, the biggest first, with their share", () => {
		const rows = expenseBreakdown(
			view([node("home", 600_00), node("food", 300_00)], 100_00),
		);

		expect(
			rows.map(({ kind, name, amount, share }) => [kind, name, amount, share]),
		).toEqual([
			["tag", "home", 600_00, 0.6],
			["tag", "food", 300_00, 0.3],
			["uncategorized", "", 100_00, 0.1],
		]);
	});

	it("gathers past five rows the rest in one, last", () => {
		const rows = expenseBreakdown(
			view([
				node("a", 500_00),
				node("b", 400_00),
				node("c", 300_00),
				node("d", 200_00),
				node("e", 60_00),
				node("f", 40_00),
			]),
		);

		expect(rows.map(({ kind, name, amount }) => [kind, name, amount])).toEqual([
			["tag", "a", 500_00],
			["tag", "b", 400_00],
			["tag", "c", 300_00],
			["tag", "d", 200_00],
			["others", "", 100_00],
		]);
	});

	it("is empty without expenses", () => {
		expect(expenseBreakdown(view([]))).toEqual([]);
	});
});
