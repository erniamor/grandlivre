import { describe, expect, it } from "vitest";
import {
	nextOccurrence,
	occurrenceAt,
	occurrencesBetween,
} from "@/routes/recurring/schedule";

const monthly = (
	startDate: string,
	interval = 1,
	endDate: string | null = null,
) => ({
	unit: "month" as const,
	interval,
	startDate,
	endDate,
});

describe("occurrenceAt", () => {
	it("repeats every N weeks, across months and years", () => {
		const biweekly = {
			unit: "week" as const,
			interval: 2,
			startDate: "2026-12-18",
		};

		expect([0, 1, 2].map((index) => occurrenceAt(biweekly, index))).toEqual([
			"2026-12-18",
			"2027-01-01",
			"2027-01-15",
		]);
	});

	it("keeps the 31st on the last day of shorter months, and comes back to it", () => {
		const rent = monthly("2026-01-31");

		expect([0, 1, 2, 3].map((index) => occurrenceAt(rent, index))).toEqual([
			"2026-01-31",
			"2026-02-28",
			"2026-03-31",
			"2026-04-30",
		]);
		expect(occurrenceAt(monthly("2028-01-31"), 1)).toBe("2028-02-29");
	});

	it("repeats every N months, and every N years, February 29th included", () => {
		expect(occurrenceAt(monthly("2026-11-15", 3), 1)).toBe("2027-02-15");
		expect(occurrenceAt(monthly("2026-11-15", 3), 4)).toBe("2027-11-15");
		const leap = {
			unit: "year" as const,
			interval: 1,
			startDate: "2028-02-29",
		};
		expect(occurrenceAt(leap, 1)).toBe("2029-02-28");
		expect(occurrenceAt(leap, 4)).toBe("2032-02-29");
	});
});

describe("nextOccurrence", () => {
	it("gives the first day on or after a day", () => {
		const rent = monthly("2026-01-31");

		expect(nextOccurrence(rent, "2026-01-01")).toBe("2026-01-31");
		expect(nextOccurrence(rent, "2026-01-31")).toBe("2026-01-31");
		expect(nextOccurrence(rent, "2026-02-01")).toBe("2026-02-28");
		expect(nextOccurrence(rent, "2026-03-01")).toBe("2026-03-31");
	});

	it("finds a day far ahead without missing one", () => {
		expect(nextOccurrence(monthly("2026-01-31"), "2036-02-15")).toBe(
			"2036-02-29",
		);
		const weekly = {
			unit: "week" as const,
			interval: 1,
			startDate: "2026-11-16",
			endDate: null,
		};
		expect(nextOccurrence(weekly, "2031-06-01")).toBe("2031-06-02");
	});

	it("gives nothing once the schedule has ended", () => {
		const loan = monthly("2026-11-01", 1, "2027-01-01");

		expect(nextOccurrence(loan, "2027-01-01")).toBe("2027-01-01");
		expect(nextOccurrence(loan, "2027-01-02")).toBeNull();
	});
});

describe("occurrencesBetween", () => {
	it("lists the days of a period, both ends included", () => {
		const biweekly = {
			unit: "week" as const,
			interval: 2,
			startDate: "2026-11-06",
			endDate: null,
		};

		expect(occurrencesBetween(biweekly, "2026-11-15", "2026-12-18")).toEqual([
			"2026-11-20",
			"2026-12-04",
			"2026-12-18",
		]);
	});

	it("stops at the end of the schedule", () => {
		expect(
			occurrencesBetween(
				monthly("2026-11-30", 1, "2027-01-15"),
				"2026-11-01",
				"2027-06-30",
			),
		).toEqual(["2026-11-30", "2026-12-30"]);
	});
});
