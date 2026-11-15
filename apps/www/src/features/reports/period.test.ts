import { describe, expect, it } from "vitest";
import {
	isPeriod,
	monthOf,
	monthPeriod,
	periodKind,
	periodLabel,
	shiftPeriod,
	yearOf,
	yearPeriod,
} from "@/features/reports/period";

describe("periods", () => {
	it("gives a month its first and last days, leap years included", () => {
		expect(monthPeriod(2026, 11)).toEqual({
			from: "2026-11-01",
			to: "2026-11-30",
		});
		expect(monthPeriod(2026, 2)).toEqual({
			from: "2026-02-01",
			to: "2026-02-28",
		});
		expect(monthPeriod(2028, 2)).toEqual({
			from: "2028-02-01",
			to: "2028-02-29",
		});
		expect(monthPeriod(2026, 12)).toEqual({
			from: "2026-12-01",
			to: "2026-12-31",
		});
	});

	it("finds the month and the year a day is in", () => {
		expect(monthOf("2026-11-15")).toEqual(monthPeriod(2026, 11));
		expect(yearOf("2026-11-15")).toEqual({
			from: "2026-01-01",
			to: "2026-12-31",
		});
	});

	it("tells a month, a year and other days apart", () => {
		expect(periodKind(monthPeriod(2026, 11))).toBe("month");
		expect(periodKind(yearPeriod(2026))).toBe("year");
		expect(periodKind({ from: "2026-11-01", to: "2026-11-29" })).toBe("custom");
		expect(periodKind({ from: "2026-11-01", to: "2026-12-31" })).toBe("custom");
	});

	it("moves a month or a year back and forth, across years", () => {
		expect(shiftPeriod(monthPeriod(2026, 11), 1)).toEqual(
			monthPeriod(2026, 12),
		);
		expect(shiftPeriod(monthPeriod(2026, 12), 1)).toEqual(monthPeriod(2027, 1));
		expect(shiftPeriod(monthPeriod(2026, 1), -1)).toEqual(
			monthPeriod(2025, 12),
		);
		expect(shiftPeriod(yearPeriod(2026), -1)).toEqual(yearPeriod(2025));
	});

	it("doesn't move other days", () => {
		const days = { from: "2026-11-03", to: "2026-11-20" };

		expect(shiftPeriod(days, 1)).toEqual(days);
	});

	it("checks the first day isn't after the last", () => {
		expect(isPeriod("2026-11-01", "2026-11-30")).toBe(true);
		expect(isPeriod("2026-11-30", "2026-11-30")).toBe(true);
		expect(isPeriod("2026-11-30", "2026-11-01")).toBe(false);
	});

	it("writes a period in words, in the language", () => {
		expect(periodLabel(monthPeriod(2026, 11), "en")).toBe("November 2026");
		expect(periodLabel(monthPeriod(2026, 11), "fr")).toBe("novembre 2026");
		expect(periodLabel(monthPeriod(2026, 1), "es")).toBe("enero de 2026");
		expect(periodLabel(yearPeriod(2026), "fr")).toBe("2026");
		// Intl puts thin spaces around the dash
		expect(
			periodLabel({ from: "2026-11-03", to: "2026-11-20" }, "en").replace(
				/\s/g,
				" ",
			),
		).toBe("Nov 3 – 20, 2026");
	});
});
