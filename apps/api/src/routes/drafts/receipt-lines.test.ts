import { describe, expect, it } from "vitest";
import { shareTotal } from "@/routes/drafts/receipt-lines";

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
