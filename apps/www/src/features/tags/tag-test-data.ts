import type { Household, Tag } from "@repo/schemas";
import type { ApiResponse } from "@/test/mock-api";

// Data shared by the tests of the tag pages

const NOW = "2026-11-14T12:00:00.000Z";

export const household: Household = {
	id: "7d6c5b4a-3f2e-4d1c-8b0a-9f8e7d6c5b4a",
	name: "The Tremblays",
	currency: "CAD",
	timeZone: "America/Toronto",
	role: "member",
	createdAt: NOW,
};

export const base = `/households/${household.id}/tags`;

const id = (n: number) =>
	`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function tag(
	n: number,
	names: Tag["names"],
	parentId: string | null = null,
): Tag {
	return {
		id: id(n),
		householdId: household.id,
		names,
		parentId,
		createdAt: NOW,
	};
}

export const home = tag(1, { en: "Home", fr: "Maison", es: "Hogar" });
export const internet = tag(2, { en: "Internet" }, home.id);
export const fiber = tag(3, { en: "Fiber", fr: "Fibre" }, internet.id);
export const car = tag(4, { en: "Car", fr: "Voiture" });
/** Named in French only. */
export const gas = tag(5, { fr: "Essence" }, car.id);

export const tags = [home, internet, fiber, car, gas];

export function tagsPage(items: Tag[]): ApiResponse {
	return {
		status: 200,
		body: {
			data: items,
			pagination: { page: 1, pageSize: 500, total: items.length },
		},
	};
}
