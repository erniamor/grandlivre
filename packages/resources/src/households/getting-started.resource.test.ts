import { describe, expect, it } from "vitest";
import type { ValidationError } from "../errors";
import { fakeApi } from "../test/fake-fetch";

const HOUSEHOLD_ID = "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f";
const TAG = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const base = `http://api.test/v1/households/${HOUSEHOLD_ID}`;

const status = {
	hidden: false,
	steps: {
		tags: true,
		accounts: true,
		wallet: false,
		members: false,
		imported: true,
		categorized: false,
		recurring: false,
		budgets: false,
	},
	uncategorized: 12,
};

const payee = {
	key: "costcoessencew",
	payee: "COSTCO ESSENCE W100",
	type: "expense",
	count: 34,
	total: 248_000,
	firstDate: "2025-06-02",
	lastDate: "2026-11-10",
};

describe("getting started", () => {
	it("reads where the household stands, and hides it", async () => {
		const read = fakeApi(200, status);
		const hide = fakeApi(200, { ...status, hidden: true });

		expect(await read.api.households.gettingStarted(HOUSEHOLD_ID)).toEqual(
			status,
		);
		expect(
			(
				await hide.api.households.updateGettingStarted(HOUSEHOLD_ID, {
					hidden: true,
				})
			).hidden,
		).toBe(true);
		expect(read.requests[0]?.url).toBe(`${base}/getting-started`);
		expect(hide.requests[0]).toMatchObject({
			url: `${base}/getting-started`,
			method: "PUT",
			body: { hidden: true },
		});
	});
});

describe("categorizing by payee", () => {
	it("lists the payees without a tag, and tags one", async () => {
		const listed = fakeApi(200, {
			data: [payee],
			pagination: { page: 1, pageSize: 200, total: 1 },
		});
		const tagged = fakeApi(200, { count: 34 });

		expect(
			await listed.api.transactions.uncategorized(HOUSEHOLD_ID, {
				pageSize: 200,
			}),
		).toEqual({ items: [payee], page: 1, pageSize: 200, total: 1 });
		expect(
			await tagged.api.transactions.categorize(HOUSEHOLD_ID, {
				key: payee.key,
				type: "expense",
				tagId: TAG,
			}),
		).toEqual({ count: 34 });
		expect(listed.requests[0]?.url).toBe(
			`${base}/transactions/uncategorized?pageSize=200`,
		);
		expect(tagged.requests[0]).toMatchObject({
			url: `${base}/transactions/categorize`,
			method: "POST",
			body: { key: payee.key, type: "expense", tagId: TAG },
		});
	});

	it("checks the tag before sending", async () => {
		const { api, fetch } = fakeApi(200, { count: 0 });

		const error = await api.transactions
			.categorize(HOUSEHOLD_ID, { key: "saaq", type: "expense", tagId: "nope" })
			.catch((reason: unknown) => reason);

		expect((error as ValidationError).issues).toEqual([
			{ field: "tagId", message: "transaction_tag_invalid" },
		]);
		expect(fetch).not.toHaveBeenCalled();
	});
});
