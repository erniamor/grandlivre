import type { Account } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import { groupAccounts } from "@/features/accounts/group-accounts";

const ALICE = { userId: "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f", name: "Alice" };
const BOB = { userId: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d", name: "Bob" };

function account(
	name: string,
	holders: Account["holders"],
	isHolder: boolean,
): Account {
	return {
		id: "9c8b7a6d-5e4f-4d3c-a2b1-0f9e8d7c6b5a",
		householdId: "7d6c5b4a-3f2e-4d1c-8b0a-9f8e7d6c5b4a",
		name,
		type: "checking",
		visibility: "details",
		balance: 0,
		openingBalance: 0,
		holders,
		isHolder,
		archived: false,
		createdAt: "2026-11-14T12:00:00.000Z",
	};
}

describe("groupAccounts", () => {
	it("separates the user's own, shared and other accounts, keeping their order", () => {
		const mine = account("Mine", [ALICE], true);
		const joint = account("Joint", [ALICE, BOB], true);
		const bobs = account("Bob's", [BOB], false);
		const orphan = account("Orphan", [], false);
		const savings = account("Savings", [ALICE], true);

		expect(groupAccounts([mine, joint, bobs, orphan, savings])).toEqual({
			mine: [mine, savings],
			shared: [joint],
			others: [bobs, orphan],
		});
	});

	it("has empty groups without accounts", () => {
		expect(groupAccounts([])).toEqual({ mine: [], shared: [], others: [] });
	});
});
