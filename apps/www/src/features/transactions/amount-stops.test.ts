import { describe, expect, it } from "vitest";
import {
	NO_MAXIMUM,
	rangeToStops,
	stopsToRange,
} from "@/features/transactions/amount-stops";

describe("the amount slider's stops", () => {
	it("leave the range open at the slider's ends", () => {
		expect(stopsToRange([0, NO_MAXIMUM], "CAD")).toEqual({
			minAmount: undefined,
			maxAmount: undefined,
		});
		expect(rangeToStops({}, "CAD")).toEqual([0, NO_MAXIMUM]);
	});

	it("stand for amounts in minor units of the currency", () => {
		expect(stopsToRange([2, 6], "CAD")).toEqual({
			minAmount: 2_500,
			maxAmount: 50_000,
		});
		expect(stopsToRange([2, 6], "JPY")).toEqual({
			minAmount: 25,
			maxAmount: 500,
		});
		expect(
			rangeToStops({ minAmount: 2_500, maxAmount: 50_000 }, "CAD"),
		).toEqual([2, 6]);
	});

	it("widen an amount between two stops to them", () => {
		expect(rangeToStops({ minAmount: 3_000, maxAmount: 3_000 }, "CAD")).toEqual(
			[2, 3],
		);
		expect(rangeToStops({ maxAmount: 9_000_000 }, "CAD")).toEqual([
			0,
			NO_MAXIMUM,
		]);
		expect(rangeToStops({ minAmount: 9_000_000 }, "CAD")).toEqual([9, 10]);
	});
});
