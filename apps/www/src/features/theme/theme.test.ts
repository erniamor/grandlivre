import { describe, expect, it } from "vitest";
import { parseTheme } from "@/features/theme/theme";

describe("parseTheme", () => {
	it("keeps an offered theme", () => {
		expect(parseTheme("ink")).toBe("ink");
	});

	it("falls back to the default theme for a missing or no longer offered one", () => {
		expect(parseTheme(undefined)).toBe("ledger");
		// A choice stored before the themes were replaced
		expect(parseTheme("stationery")).toBe("ledger");
		expect(parseTheme("variant-a")).toBe("ledger");
	});
});
