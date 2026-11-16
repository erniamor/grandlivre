import { describe, expect, it } from "vitest";
import { allocate, partsOf, settleUp } from "@/routes/sharing/split";

describe("allocate", () => {
	it("splits to the cent, the shares adding up exactly", () => {
		expect(allocate(10_000, [1, 1, 1])).toEqual([3_334, 3_333, 3_333]);
		expect(allocate(12_345, [60, 40])).toEqual([7_407, 4_938]);
		expect(allocate(1, [1, 1])).toEqual([1, 0]);
	});
});

describe("partsOf", () => {
	it("splits in equal parts, by weights, or by amounts", () => {
		expect(partsOf({ mode: "equal", userIds: ["a", "b"] }, 12_001)).toEqual({
			parts: [
				{ userId: "a", amount: 6_001 },
				{ userId: "b", amount: 6_000 },
			],
		});
		expect(
			partsOf(
				{
					mode: "weights",
					parts: [
						{ userId: "a", weight: 60 },
						{ userId: "b", weight: 40 },
						{ userId: "c", weight: 0 },
					],
				},
				10_000,
			),
		).toEqual({
			parts: [
				{ userId: "a", amount: 6_000 },
				{ userId: "b", amount: 4_000 },
				{ userId: "c", amount: 0 },
			],
		});
		expect(
			partsOf(
				{
					mode: "amounts",
					parts: [
						{ userId: "a", amount: 2_500 },
						{ userId: "b", amount: 7_500 },
					],
				},
				10_000,
			),
		).toEqual({
			parts: [
				{ userId: "a", amount: 2_500 },
				{ userId: "b", amount: 7_500 },
			],
		});
	});

	it("says what is wrong with a split", () => {
		expect(
			partsOf(
				{ mode: "amounts", parts: [{ userId: "a", amount: 9_999 }] },
				10_000,
			),
		).toEqual({ error: "share_amounts_mismatch" });
		expect(partsOf({ mode: "equal", userIds: ["a", "a"] }, 100)).toEqual({
			error: "share_members_invalid",
		});
		expect(
			partsOf({ mode: "weights", parts: [{ userId: "a", weight: 0 }] }, 100),
		).toEqual({ error: "share_weight_invalid" });
	});
});

describe("settleUp", () => {
	it("settles two members with one payment", () => {
		expect(
			settleUp([
				{ userId: "alice", balance: 14_520 },
				{ userId: "bob", balance: -14_520 },
			]),
		).toEqual([{ fromUserId: "bob", toUserId: "alice", amount: 14_520 }]);
	});

	it("lets the one who owes pay the one owed directly", () => {
		// Bob owes Alice 10, Alice owes Carol 10: Bob pays Carol
		expect(
			settleUp([
				{ userId: "alice", balance: 0 },
				{ userId: "bob", balance: -1_000 },
				{ userId: "carol", balance: 1_000 },
			]),
		).toEqual([{ fromUserId: "bob", toUserId: "carol", amount: 1_000 }]);
	});

	it("brings every balance to zero in few payments", () => {
		const payments = settleUp([
			{ userId: "a", balance: 5_000 },
			{ userId: "b", balance: 3_000 },
			{ userId: "c", balance: -6_000 },
			{ userId: "d", balance: -2_000 },
		]);

		expect(payments).toHaveLength(3);
		const net = new Map<string, number>();
		for (const { fromUserId, toUserId, amount } of payments) {
			net.set(fromUserId, (net.get(fromUserId) ?? 0) + amount);
			net.set(toUserId, (net.get(toUserId) ?? 0) - amount);
		}
		expect(Object.fromEntries(net)).toEqual({
			a: -5_000,
			b: -3_000,
			c: 6_000,
			d: 2_000,
		});
	});

	it("needs nothing when everyone is even", () => {
		expect(settleUp([{ userId: "a", balance: 0 }])).toEqual([]);
	});
});
