import type { Household } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import { currentHousehold } from "@/features/households/households-query";
import { parsePreferredHousehold } from "@/features/households/preferred-household";

const household = (
	name: string,
	id = "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f",
): Household => ({
	id,
	name,
	currency: "CAD",
	timeZone: "America/Toronto",
	expenseSharing: false,
	role: "owner",
	createdAt: "2026-11-14T12:00:00.000Z",
});

const page = (items: Household[]) => ({
	items,
	page: 1,
	pageSize: 20,
	total: items.length,
});

describe("currentHousehold", () => {
	it("is null for a user without a household", () => {
		expect(currentHousehold(page([]))).toBeNull();
	});

	it("is the household chosen on this device, while the user belongs to it", () => {
		const first = household("The Tremblays");
		const second = household(
			"The Gagnons",
			"9c8b7a6d-5e4f-4d3c-a2b1-0f9e8d7c6b5a",
		);

		expect(currentHousehold(page([first, second]), second.id)).toBe(second);
		// Left or removed since: the first one
		expect(
			currentHousehold(page([first]), "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"),
		).toBe(first);
	});

	it("is the first household otherwise", () => {
		const first = household("The Tremblays");

		expect(currentHousehold(page([first, household("The Gagnons")]))).toBe(
			first,
		);
	});
});

describe("parsePreferredHousehold", () => {
	it("keeps an id, and drops anything else", () => {
		expect(
			parsePreferredHousehold("5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f"),
		).toBe("5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f");
		expect(parsePreferredHousehold("../admin")).toBeUndefined();
		expect(parsePreferredHousehold(undefined)).toBeUndefined();
	});
});
