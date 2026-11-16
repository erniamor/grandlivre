import { describe, expect, it } from "vitest";
import { ApiError, type ValidationError } from "../errors";
import { fakeApi } from "../test/fake-fetch";

const HOUSEHOLD_ID = "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f";
const ALICE = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const BOB = "9c8b7a6d-5e4f-4d3c-a2b1-0f9e8d7c6b5a";
const ACCOUNT = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const NOW = "2026-11-15T12:00:00.000Z";

const base = `http://api.test/v1/households/${HOUSEHOLD_ID}/sharing`;

const overview = {
	weights: [
		{ userId: ALICE, weight: 1 },
		{ userId: BOB, weight: 1 },
	],
	balances: [
		{ userId: ALICE, name: "Alice", isMember: true, balance: 6_000 },
		{ userId: BOB, name: "Bob", isMember: true, balance: -6_000 },
	],
	suggestions: [{ fromUserId: BOB, toUserId: ALICE, amount: 6_000 }],
};

const settlement = {
	id: ACCOUNT,
	fromUserId: BOB,
	toUserId: ALICE,
	amount: 6_000,
	date: "2026-11-15",
	note: null,
	transactionId: null,
	createdAt: NOW,
};

const page = <T>(data: T[]) => ({
	data,
	pagination: { page: 1, pageSize: 50, total: data.length },
});

describe("sharing", () => {
	it("reads where the members stand", async () => {
		const { api, requests } = fakeApi(200, overview);

		expect(await api.sharing.overview(HOUSEHOLD_ID)).toEqual(overview);
		expect(requests[0]?.url).toBe(base);
	});

	it("says when the household doesn't share expenses", async () => {
		const { api } = fakeApi(409, {
			error: { code: "sharing_disabled", message: "Off" },
		});

		const error = await api.sharing
			.overview(HOUSEHOLD_ID)
			.catch((reason: unknown) => reason);

		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({ status: 409, code: "sharing_disabled" });
	});

	it("sets the default split, checked before sending", async () => {
		const { api, requests, fetch } = fakeApi(200, overview);

		await api.sharing.setWeights(HOUSEHOLD_ID, {
			weights: [{ userId: ALICE, weight: 60 }],
		});
		const error = await api.sharing
			.setWeights(HOUSEHOLD_ID, { weights: [{ userId: ALICE, weight: -1 }] })
			.catch((reason: unknown) => reason);

		expect(requests[0]).toMatchObject({
			url: `${base}/weights`,
			method: "PUT",
			body: { weights: [{ userId: ALICE, weight: 60 }] },
		});
		expect((error as ValidationError).issues).toEqual([
			{ field: "weights.0.weight", message: "share_weight_invalid" },
		]);
		expect(fetch).toHaveBeenCalledOnce();
	});

	it("lists the shared expenses and the settlements, without the envelope", async () => {
		const expense = {
			transactionId: ACCOUNT,
			type: "expense",
			date: "2026-11-14",
			payee: "IGA",
			amount: 12_000,
			paidBy: ALICE,
			parts: [
				{ userId: ALICE, amount: 6_000 },
				{ userId: BOB, amount: 6_000 },
			],
		};
		const expenses = fakeApi(200, page([expense]));
		const settlements = fakeApi(200, page([settlement]));

		expect(
			(await expenses.api.sharing.expenses(HOUSEHOLD_ID, { page: 2 })).items,
		).toEqual([expense]);
		expect(
			(await settlements.api.sharing.settlements(HOUSEHOLD_ID)).items,
		).toEqual([settlement]);
		expect(expenses.requests[0]?.url).toBe(`${base}/expenses?page=2`);
		expect(settlements.requests[0]?.url).toBe(`${base}/settlements`);
	});

	it("records a settlement, with its transfer, and refuses a member paying themselves", async () => {
		const { api, requests, fetch } = fakeApi(201, settlement);
		const payment = {
			fromUserId: BOB,
			toUserId: ALICE,
			amount: 6_000,
			date: "2026-11-15",
			note: " Interac ",
			transfer: { fromAccountId: ACCOUNT, toAccountId: ACCOUNT },
		};

		expect(await api.sharing.settle(HOUSEHOLD_ID, payment)).toEqual(settlement);
		const error = await api.sharing
			.settle(HOUSEHOLD_ID, { ...payment, toUserId: BOB })
			.catch((reason: unknown) => reason);

		expect(requests[0]).toMatchObject({
			url: `${base}/settlements`,
			method: "POST",
			body: { ...payment, note: "Interac" },
		});
		expect((error as ValidationError).issues).toEqual([
			{ field: "toUserId", message: "settlement_same_member" },
		]);
		expect(fetch).toHaveBeenCalledOnce();
	});

	it("deletes a settlement", async () => {
		const { api, requests } = fakeApi(204);

		await api.sharing.removeSettlement(HOUSEHOLD_ID, "a/b");

		expect(requests[0]).toMatchObject({
			url: `${base}/settlements/a%2Fb`,
			method: "DELETE",
		});
	});
});
