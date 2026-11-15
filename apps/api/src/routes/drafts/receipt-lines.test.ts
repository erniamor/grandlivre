import { describe, expect, it } from "vitest";
import { shareTaxes, shareTotal } from "@/routes/drafts/receipt-lines";

const sum = (groups: { amount: number }[]) =>
	groups.reduce((total, group) => total + group.amount, 0);

describe("shareTotal", () => {
	it("shares the taxes in proportion, the lines adding up to the total to the cent", () => {
		// 120.00 + 45.00 + 15.00 = 180.00, taxes 14.975 % → 206.96
		const lines = shareTotal(
			20_696,
			[
				{ key: "groceries", amount: 12_000 },
				{ key: "household", amount: 4500 },
				{ key: "toys", amount: 1500 },
			],
			null,
		);

		expect(lines).toEqual([
			{ key: "groceries", amount: 13_797 },
			{ key: "household", amount: 5174 },
			{ key: "toys", amount: 1725 },
		]);
		expect(sum(lines)).toBe(20_696);
	});

	it("keeps the amounts when there are no taxes", () => {
		expect(
			shareTotal(
				5000,
				[
					{ key: "a", amount: 3000 },
					{ key: "b", amount: 2000 },
				],
				null,
			),
		).toEqual([
			{ key: "a", amount: 3000 },
			{ key: "b", amount: 2000 },
		]);
	});

	it("gives the cents left by rounding to the groups that lost the most", () => {
		const lines = shareTotal(
			100,
			[
				{ key: "a", amount: 1 },
				{ key: "b", amount: 1 },
				{ key: "c", amount: 1 },
			],
			null,
		);

		expect(lines.map((line) => line.amount)).toEqual([34, 33, 33]);
	});

	it("lets a group of discounts alone lower the biggest group", () => {
		expect(
			shareTotal(
				9000,
				[
					{ key: "groceries", amount: 8000 },
					{ key: "coupons", amount: -1000 },
					{ key: "toys", amount: 2000 },
				],
				null,
			),
		).toEqual([
			{ key: "groceries", amount: 7000 },
			{ key: "toys", amount: 2000 },
		]);
	});

	it("puts the whole total on one line without a positive group", () => {
		expect(shareTotal(1250, [], "none")).toEqual([
			{ key: "none", amount: 1250 },
		]);
		expect(shareTotal(1250, [{ key: "a", amount: -5 }], "none")).toEqual([
			{ key: "none", amount: 1250 },
		]);
	});

	it("follows the total even when the items don't add up to it", () => {
		const lines = shareTotal(
			10_000,
			[
				{ key: "a", amount: 6000 },
				{ key: "b", amount: 2000 },
			],
			null,
		);

		expect(sum(lines)).toBe(10_000);
		expect(lines).toEqual([
			{ key: "a", amount: 7500 },
			{ key: "b", amount: 2500 },
		]);
	});
});

describe("shareTaxes", () => {
	it("puts the taxes on the taxed items only, the lines adding up to the total", () => {
		// A Quebec grocery receipt: 142.85 of food, 62.94 of it taxed (water,
		// soft drinks, a sweet), and 14.48 of kitchen tools, all taxed;
		// 11.59 of taxes and deposits on top
		const lines = shareTaxes(
			16_892,
			[
				{ key: "groceries", amount: 14_285, taxable: 6294 },
				{ key: "home", amount: 1448, taxable: 1448 },
			],
			null,
		);

		expect(lines).toEqual([
			{ key: "groceries", amount: 15_227 },
			{ key: "home", amount: 1665 },
		]);
		expect(sum(lines)).toBe(16_892);
	});

	it("leaves an untaxed group at its items' amount", () => {
		expect(
			shareTaxes(
				2650,
				[
					{ key: "groceries", amount: 1500, taxable: 0 },
					{ key: "home", amount: 1000, taxable: 1000 },
				],
				null,
			),
		).toEqual([
			{ key: "groceries", amount: 1500 },
			{ key: "home", amount: 1150 },
		]);
	});

	it("shares out in proportion to every amount when nothing is taxed, or the total is below the items", () => {
		const groups = [
			{ key: "a", amount: 3000, taxable: 0 },
			{ key: "b", amount: 1000, taxable: 0 },
		];

		expect(shareTaxes(4400, groups, null)).toEqual(
			shareTotal(4400, groups, null),
		);
		expect(
			shareTaxes(
				3600,
				[
					{ key: "a", amount: 3000, taxable: 3000 },
					{ key: "b", amount: 1000, taxable: 0 },
				],
				null,
			),
		).toEqual([
			{ key: "a", amount: 2700 },
			{ key: "b", amount: 900 },
		]);
	});

	it("shares out in proportion when a group would end up at zero or below", () => {
		// A coupon tagged on its own, with nothing taxed under its tag
		const lines = shareTaxes(
			1150,
			[
				{ key: "toys", amount: 1500, taxable: 1500 },
				{ key: "coupons", amount: -500, taxable: 0 },
			],
			null,
		);

		expect(lines).toEqual([{ key: "toys", amount: 1150 }]);
	});
});
