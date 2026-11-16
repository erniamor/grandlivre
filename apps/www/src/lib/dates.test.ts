import { describe, expect, it } from "vitest";
import { formatDay, formatShortDay } from "@/lib/dates";

describe("formatDay", () => {
	it("writes a calendar day in words, in the language", () => {
		expect(formatDay("2026-11-14", "en")).toBe("Saturday, November 14, 2026");
		expect(formatDay("2026-11-14", "fr")).toBe("samedi 14 novembre 2026");
		expect(formatDay("2026-11-14", "es")).toBe(
			"sábado, 14 de noviembre de 2026",
		);
	});

	it("keeps the day whatever the time zone: the first and last days of a year", () => {
		expect(formatDay("2026-01-01", "en")).toBe("Thursday, January 1, 2026");
		expect(formatDay("2026-12-31", "en")).toBe("Thursday, December 31, 2026");
	});
});

describe("formatShortDay", () => {
	it("writes a day in few words, the way each language does", () => {
		expect(formatShortDay("2026-11-14", "en")).toBe("Nov 14, 2026");
		expect(formatShortDay("2026-11-14", "fr")).toBe("14 nov. 2026");
		expect(formatShortDay("2026-01-01", "en")).toBe("Jan 1, 2026");
	});
});
