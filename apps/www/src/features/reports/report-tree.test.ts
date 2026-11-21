import type { Tag, TagReport } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import {
	buildReport,
	monthTotals,
	type ReportNode,
} from "@/features/reports/report-tree";

function tag(id: string, en: string, parentId: string | null = null): Tag {
	return {
		id,
		householdId: "home",
		names: { en, fr: `${en} (fr)` },
		parentId,
		createdAt: "2026-11-14T12:00:00.000Z",
	};
}

const tags = [
	tag("home", "Home"),
	tag("mortgage", "Mortgage", "home"),
	tag("internet", "Internet", "home"),
	tag("food", "Food"),
	tag("groceries", "Groceries", "food"),
	tag("restaurant", "Restaurant", "food"),
	tag("income", "Income"),
	tag("salary", "Salary", "income"),
	tag("car", "Car"),
];

function report(totals: [string | null, number, number][]): TagReport {
	return {
		from: "2026-11-01",
		to: "2026-11-30",
		tags: totals.map(([tagId, expense, income]) => ({
			tagId,
			undetermined: false,
			expense,
			income,
		})),
	};
}

/** The tree as names, amounts and shares in percent. */
const outline = (nodes: ReportNode[]): unknown[] =>
	nodes.map(({ name, amount, share, children }) =>
		children.length > 0
			? [name, amount, Math.round(share * 100), outline(children)]
			: [name, amount, Math.round(share * 100)],
	);

describe("buildReport", () => {
	it("adds up each tag with the tags under it, the biggest first", () => {
		const view = buildReport(
			report([
				["mortgage", 140_000, 0],
				["internet", 8000, 0],
				["groceries", 40_000, 0],
				["restaurant", 12_000, 0],
			]),
			tags,
			"en",
		);

		expect(view.expenses.total).toBe(200_000);
		expect(outline(view.expenses.nodes)).toEqual([
			[
				"Home",
				148_000,
				74,
				[
					["Mortgage", 140_000, 70],
					["Internet", 8000, 4],
				],
			],
			[
				"Food",
				52_000,
				26,
				[
					["Groceries", 40_000, 20],
					["Restaurant", 12_000, 6],
				],
			],
		]);
		expect(view.incomes).toEqual({
			total: 0,
			nodes: [],
			uncategorized: 0,
			undetermined: 0,
		});
		expect(view.balance).toBe(-200_000);
	});

	it("counts a tag's own lines with those of its sub-tags", () => {
		const view = buildReport(
			report([
				["food", 5000, 0],
				["groceries", 20_000, 0],
			]),
			tags,
			"en",
		);

		expect(outline(view.expenses.nodes)).toEqual([
			["Food", 25_000, 100, [["Groceries", 20_000, 80]]],
		]);
	});

	it("lowers a tag's expenses by its refunds", () => {
		const view = buildReport(
			report([
				["groceries", 40_000, 3000],
				["restaurant", 12_000, 0],
			]),
			tags,
			"en",
		);

		expect(view.expenses.total).toBe(49_000);
		expect(outline(view.expenses.nodes)).toEqual([
			[
				"Food",
				49_000,
				100,
				[
					["Groceries", 37_000, 76],
					["Restaurant", 12_000, 24],
				],
			],
		]);
		expect(view.incomes.total).toBe(0);
	});

	it("shows a sub-tag that brought more in than it cost as lowering its parent", () => {
		const view = buildReport(
			report([
				["groceries", 0, 3000],
				["restaurant", 12_000, 0],
			]),
			tags,
			"en",
		);

		expect(outline(view.expenses.nodes)).toEqual([
			[
				"Food",
				9000,
				100,
				[
					["Restaurant", 12_000, 133],
					["Groceries", -3000, -33],
				],
			],
		]);
	});

	it("puts a tag that brought in more than it cost with the incomes", () => {
		const view = buildReport(
			report([
				["salary", 0, 250_000],
				["car", 40_000, 0],
			]),
			tags,
			"en",
		);

		expect(outline(view.incomes.nodes)).toEqual([
			["Income", 250_000, 100, [["Salary", 250_000, 100]]],
		]);
		expect(outline(view.expenses.nodes)).toEqual([["Car", 40_000, 100]]);
		expect(view.balance).toBe(210_000);
	});

	it("leaves out a tag whose refunds cancel its expenses", () => {
		const view = buildReport(report([["car", 5000, 5000]]), tags, "en");

		expect(view.expenses.nodes).toEqual([]);
		expect(view.incomes.nodes).toEqual([]);
		expect(view.isEmpty).toBe(false);
	});

	it("keeps the uncategorized expenses and incomes apart, in the totals", () => {
		const view = buildReport(
			report([
				[null, 1500, 250_000],
				["car", 40_000, 0],
			]),
			tags,
			"en",
		);

		expect(view.expenses).toMatchObject({ total: 41_500, uncategorized: 1500 });
		expect(view.incomes).toMatchObject({
			total: 250_000,
			uncategorized: 250_000,
		});
		expect(outline(view.expenses.nodes)).toEqual([["Car", 40_000, 96]]);
		expect(view.balance).toBe(208_500);
	});

	it("keeps the undetermined lines apart from those to categorize, in the totals", () => {
		const view = buildReport(
			{
				from: "2026-11-01",
				to: "2026-11-30",
				tags: [
					{ tagId: null, undetermined: false, expense: 1500, income: 0 },
					{ tagId: null, undetermined: true, expense: 8000, income: 2000 },
					{ tagId: "car", undetermined: false, expense: 40_000, income: 0 },
				],
			},
			tags,
			"en",
		);

		expect(view.expenses).toMatchObject({
			total: 49_500,
			uncategorized: 1500,
			undetermined: 8000,
		});
		expect(view.incomes).toMatchObject({
			total: 2000,
			uncategorized: 0,
			undetermined: 2000,
		});
	});

	it("keeps the period's balance equal to all incomes minus all expenses", () => {
		const totals: [string | null, number, number][] = [
			[null, 1500, 250_000],
			["groceries", 40_000, 3000],
			["restaurant", 0, 2000],
			["salary", 0, 100_000],
			["car", 5000, 5000],
		];
		const view = buildReport(report(totals), tags, "en");
		const income = totals.reduce((sum, [, , value]) => sum + value, 0);
		const expense = totals.reduce((sum, [, value]) => sum + value, 0);

		expect(view.balance).toBe(income - expense);
		expect(view.incomes.total - view.expenses.total).toBe(income - expense);
	});

	it("names the tags in the user's language", () => {
		const view = buildReport(report([["car", 100, 0]]), tags, "fr");

		expect(view.expenses.nodes[0]?.name).toBe("Car (fr)");
	});

	it("is empty for a period without lines", () => {
		const view = buildReport(report([]), tags, "en");

		expect(view.isEmpty).toBe(true);
		expect(view.balance).toBe(0);
	});
});

describe("monthTotals", () => {
	const month = {
		month: "2026-11",
		expense: 46_500,
		income: 253_000,
		tags: [
			{
				tagId: "groceries",
				undetermined: false,
				expense: 40_000,
				income: 3000,
			},
			{ tagId: "restaurant", undetermined: false, expense: 5000, income: 0 },
			{ tagId: "salary", undetermined: false, expense: 0, income: 250_000 },
			{ tagId: null, undetermined: false, expense: 1500, income: 0 },
		],
	};

	it("counts a month as a report counts a period: refunds lower their tag", () => {
		expect(monthTotals(month, tags, "en")).toEqual({
			expense: 43_500,
			income: 250_000,
		});
	});

	it("keeps to a tag and the tags under it", () => {
		expect(monthTotals(month, tags, "en", "food")).toEqual({
			expense: 42_000,
			income: 0,
		});
		expect(monthTotals(month, tags, "en", "groceries")).toEqual({
			expense: 37_000,
			income: 0,
		});
		expect(monthTotals(month, tags, "en", "car")).toEqual({
			expense: 0,
			income: 0,
		});
	});
});
