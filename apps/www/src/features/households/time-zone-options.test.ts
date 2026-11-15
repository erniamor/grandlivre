import { describe, expect, it } from "vitest";
import {
	browserTimeZone,
	timeZoneOptions,
} from "@/features/households/time-zone-options";

describe("timeZoneOptions", () => {
	it("lists the platform's time zones, made readable, in order", () => {
		const options = timeZoneOptions("America/Toronto");

		expect(options).toContainEqual({
			value: "America/St_Johns",
			label: "America / St Johns",
		});
		expect(options.map((option) => option.value)).toEqual(
			[...options.map((option) => option.value)].sort((a, b) =>
				a.localeCompare(b),
			),
		);
	});

	it("keeps the household's own, even when unlisted", () => {
		expect(timeZoneOptions("UTC").map((option) => option.value)).toContain(
			"UTC",
		);
	});
});

describe("browserTimeZone", () => {
	it("gives the browser's time zone", () => {
		expect(browserTimeZone()).toBe(
			Intl.DateTimeFormat().resolvedOptions().timeZone,
		);
	});
});
