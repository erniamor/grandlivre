import type { Account, Household, HouseholdMember } from "@repo/schemas";
import type { ApiResponse } from "@/test/mock-api";
import { aliceProfile } from "@/test/mock-api";

// Data shared by the tests of the account pages

export const NOW = "2026-11-14T12:00:00.000Z";
export const BOB_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
export const ACCOUNT_ID = "9c8b7a6d-5e4f-4d3c-a2b1-0f9e8d7c6b5a";

export const household: Household = {
	id: "7d6c5b4a-3f2e-4d1c-8b0a-9f8e7d6c5b4a",
	name: "The Tremblays",
	currency: "CAD",
	timeZone: "America/Toronto",
	expenseSharing: false,
	role: "owner",
	createdAt: NOW,
};

export const members: HouseholdMember[] = [
	{
		userId: aliceProfile.id,
		name: "Alice",
		email: "alice@example.com",
		image: null,
		role: "owner",
		joinedAt: NOW,
	},
	{
		userId: BOB_ID,
		name: "Bob",
		email: "bob@example.com",
		image: null,
		role: "member",
		joinedAt: NOW,
	},
];

/** Alice's own chequing account. */
export const chequing: Account = {
	id: ACCOUNT_ID,
	householdId: household.id,
	name: "Everyday",
	type: "checking",
	visibility: "details",
	balance: 125_050,
	openingBalance: 125_050,
	holders: [{ userId: aliceProfile.id, name: "Alice" }],
	isHolder: true,
	archived: false,
	createdAt: NOW,
};

export function page(items: unknown[]): ApiResponse {
	return {
		status: 200,
		body: {
			data: items,
			pagination: { page: 1, pageSize: 100, total: items.length },
		},
	};
}
