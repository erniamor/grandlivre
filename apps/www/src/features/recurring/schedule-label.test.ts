import { describe, expect, it } from "vitest";
import { scheduleLabel } from "@/features/recurring/schedule-label";
import { setTestLocale } from "@/test/locale";

describe("scheduleLabel", () => {
	it("says how often, once or every few", () => {
		expect(scheduleLabel({ unit: "month", interval: 1 })).toBe("Every month");
		expect(scheduleLabel({ unit: "week", interval: 2 })).toBe("Every 2 weeks");
	});

	it("says it in the user's language", () => {
		setTestLocale("fr");
		expect(scheduleLabel({ unit: "week", interval: 1 })).toBe(
			"Toutes les semaines",
		);
		expect(scheduleLabel({ unit: "month", interval: 3 })).toBe(
			"Tous les 3 mois",
		);
		setTestLocale("es");
		expect(scheduleLabel({ unit: "year", interval: 1 })).toBe("Cada año");
	});
});
