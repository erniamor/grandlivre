import { describe, expect, it } from "vitest";
import { shareStateOf, toShareSplit } from "@/features/sharing/share-form";

const MEMBERS = ["alice", "bob", "carol"];

describe("shareStateOf", () => {
	it("starts from the default split: equal parts when every weight is the same", () => {
		expect(
			shareStateOf(
				undefined,
				MEMBERS.map((userId) => ({ userId, weight: 1 })),
				"CAD",
				"en",
			),
		).toMatchObject({ on: false, mode: "equal", included: MEMBERS });
		expect(
			shareStateOf(
				undefined,
				[
					{ userId: "alice", weight: 60 },
					{ userId: "bob", weight: 40 },
					{ userId: "carol", weight: 0 },
				],
				"CAD",
				"en",
			),
		).toMatchObject({
			mode: "weights",
			included: ["alice", "bob"],
			weights: { alice: "60", bob: "40", carol: "0" },
		});
	});

	it("starts from how a transaction is shared", () => {
		expect(
			shareStateOf(
				{
					paidBy: "alice",
					split: {
						mode: "amounts",
						parts: [
							{ userId: "alice", amount: 2_500 },
							{ userId: "bob", amount: 7_500 },
						],
					},
					parts: [
						{ userId: "alice", amount: 2_500 },
						{ userId: "bob", amount: 7_500 },
					],
				},
				[],
				"CAD",
				"fr",
			),
		).toMatchObject({
			on: true,
			mode: "amounts",
			amounts: { alice: "25,00", bob: "75,00" },
		});
	});
});

describe("toShareSplit", () => {
	const state = {
		on: true,
		mode: "equal" as const,
		included: ["bob", "alice"],
		weights: { alice: "60", bob: "40", carol: "" },
		amounts: { alice: "25", bob: "75,50" },
	};

	it("gives the split of each mode, members in the household's order", () => {
		expect(toShareSplit(state, MEMBERS, "CAD", "fr")).toEqual({
			ok: true,
			split: { mode: "equal", userIds: ["alice", "bob"] },
		});
		expect(
			toShareSplit({ ...state, mode: "weights" }, MEMBERS, "CAD", "fr"),
		).toEqual({
			ok: true,
			split: {
				mode: "weights",
				parts: [
					{ userId: "alice", weight: 60 },
					{ userId: "bob", weight: 40 },
				],
			},
		});
		expect(
			toShareSplit({ ...state, mode: "amounts" }, MEMBERS, "CAD", "fr"),
		).toEqual({
			ok: true,
			split: {
				mode: "amounts",
				parts: [
					{ userId: "alice", amount: 2_500 },
					{ userId: "bob", amount: 7_550 },
				],
			},
		});
	});

	it("says what is wrong", () => {
		expect(
			toShareSplit({ ...state, included: [] }, MEMBERS, "CAD", "en"),
		).toEqual({ ok: false, error: "share_members_required" });
		expect(
			toShareSplit(
				{ ...state, mode: "weights", weights: { alice: "1.5" } },
				MEMBERS,
				"CAD",
				"en",
			),
		).toEqual({ ok: false, error: "share_weight_invalid" });
		expect(
			toShareSplit(
				{ ...state, mode: "amounts", amounts: { alice: "abc" } },
				MEMBERS,
				"CAD",
				"en",
			),
		).toEqual({ ok: false, error: "amount_invalid" });
	});
});
