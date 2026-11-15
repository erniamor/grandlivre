import { describe, expect, it } from "vitest";
import { todayIn } from "@/lib/dates";

describe("todayIn", () => {
	it("gives the day it is in a time zone, which can differ from UTC's", () => {
		// 2026-11-16 at 03:00 UTC is still the 15th in Montreal
		const now = new Date("2026-11-16T03:00:00Z");

		expect(todayIn("America/Toronto", now)).toBe("2026-11-15");
		expect(todayIn("Europe/Paris", now)).toBe("2026-11-16");
		expect(todayIn("UTC", now)).toBe("2026-11-16");
	});
});
