import { describe, expect, it } from "vitest";
import { createSettlementSchema, shareSplitSchema } from "./sharing.schema";
import { createTransactionSchema } from "./transaction.schema";

const ALICE = "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f";
const BOB = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

const messages = (result: { error?: { issues: { message: string }[] } }) =>
	result.error?.issues.map((issue) => issue.message) ?? [];

describe("shareSplitSchema", () => {
	it("accepts equal parts, weights and amounts", () => {
		for (const split of [
			{ mode: "equal", userIds: [ALICE, BOB] },
			{ mode: "weights", parts: [{ userId: ALICE, weight: 60 }] },
			{ mode: "amounts", parts: [{ userId: BOB, amount: 1_000 }] },
		]) {
			expect(shareSplitSchema.parse(split)).toEqual(split);
		}
	});

	it("rejects an unknown mode, no member, and a weight out of bounds", () => {
		expect(messages(shareSplitSchema.safeParse({ mode: "half" }))).toEqual([
			"share_mode_invalid",
		]);
		expect(
			messages(shareSplitSchema.safeParse({ mode: "equal", userIds: [] })),
		).toEqual(["share_members_required"]);
		expect(
			messages(
				shareSplitSchema.safeParse({
					mode: "weights",
					parts: [{ userId: ALICE, weight: 1.5 }],
				}),
			),
		).toEqual(["share_weight_invalid"]);
	});

	it("comes with an expense or an income, never a transfer", () => {
		const shares = { mode: "equal", userIds: [ALICE] };

		expect(
			createTransactionSchema.safeParse({
				type: "expense",
				accountId: ALICE,
				date: "2026-11-14",
				lines: [{ amount: 100 }],
				shares,
			}).success,
		).toBe(true);
		expect(
			createTransactionSchema.safeParse({
				type: "transfer",
				accountId: ALICE,
				toAccountId: BOB,
				date: "2026-11-14",
				amount: 100,
				shares,
			}).success,
		).toBe(false);
	});
});

describe("createSettlementSchema", () => {
	it("rejects a member paying themselves", () => {
		expect(
			messages(
				createSettlementSchema.safeParse({
					fromUserId: ALICE,
					toUserId: ALICE,
					amount: 100,
					date: "2026-11-15",
				}),
			),
		).toEqual(["settlement_same_member"]);
	});
});
