import { describe, expect, it } from "vitest";
import { everydayAccount } from "@/features/imports/import-test-data";
import {
	countByFilter,
	defaultFilter,
	type FilteredLine,
	visibleLines,
} from "@/features/imports/line-filters";

const [fuel, atm, out, pay] = everydayAccount.lines.map(
	(line): FilteredLine => ({ line, status: line.status, paired: false }),
) as [FilteredLine, FilteredLine, FilteredLine, FilteredLine];

describe("line filters", () => {
	it("puts a line recorded from its pair with what is known, and counts each filter", () => {
		const lines = [fuel, atm, { ...out, paired: true }, pay];

		expect(countByFilter(lines)).toEqual({
			fresh: 2,
			known: 1,
			recurring: 0,
			imported: 1,
		});
	});

	it("starts on the lines to decide, else on the first filter holding some", () => {
		expect(
			defaultFilter({ fresh: 2, known: 1, recurring: 0, imported: 1 }),
		).toBe("fresh");
		expect(
			defaultFilter({ fresh: 0, known: 0, recurring: 0, imported: 4 }),
		).toBe("imported");
	});

	it("searches payees and descriptions, accents and case aside, and always shows a line to correct", () => {
		const lines = [fuel, atm, out, pay];

		expect(
			visibleLines(lines, "fresh", "Préautorisé", new Set()).map(
				({ line }) => line.externalId,
			),
		).toEqual(["fuel-0"]);
		// Imported before, but still to correct: shown whatever the filter
		expect(
			visibleLines(lines, "fresh", "coin", new Set(["pay-0"])).map(
				({ line }) => line.externalId,
			),
		).toEqual(["fuel-0", "pay-0"]);
	});
});
