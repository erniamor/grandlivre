import type { Household } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import { currentHousehold } from "@/features/households/households-query";

const household = (name: string): Household => ({
	id: "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f",
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

	it("is the first household the user joined", () => {
		const first = household("The Tremblays");

		expect(currentHousehold(page([first, household("The Gagnons")]))).toBe(
			first,
		);
	});
});
