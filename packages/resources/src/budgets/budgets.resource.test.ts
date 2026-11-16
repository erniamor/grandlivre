import { describe, expect, it } from "vitest";
import { NotFoundError, ServerError, type ValidationError } from "../errors";
import { fakeApi } from "../test/fake-fetch";

const HOUSEHOLD_ID = "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f";
const TAG_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const NOW = "2026-11-15T12:00:00.000Z";

const base = `http://api.test/v1/households/${HOUSEHOLD_ID}/budgets`;

const november = {
	month: "2026-11",
	budgets: [
		{
			tagId: TAG_ID,
			period: "month",
			amount: 50_000,
			since: "2026-11",
			spent: 16_000,
			upcoming: 2_000,
		},
	],
};

describe("budgets", () => {
	it("lists the budgets of the current month, or of the month asked", async () => {
		const current = fakeApi(200, november);
		const asked = fakeApi(200, november);

		expect(await current.api.budgets.list(HOUSEHOLD_ID)).toEqual(november);
		await asked.api.budgets.list(HOUSEHOLD_ID, { month: "2026-10" });

		expect(current.requests[0]?.url).toBe(base);
		expect(asked.requests[0]?.url).toBe(`${base}?month=2026-10`);
	});

	it("rejects a month that isn't one before sending", async () => {
		const { api, fetch } = fakeApi(200, november);

		const error = await api.budgets
			.list(HOUSEHOLD_ID, { month: "2026-13" })
			.catch((reason: unknown) => reason);

		expect((error as ValidationError).issues).toEqual([
			{ field: "month", message: "budget_month_invalid" },
		]);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("sets the budget of a tag from a month on", async () => {
		const budget = {
			tagId: TAG_ID,
			period: "year",
			amount: 120_000,
			from: "2026-01",
			updatedAt: NOW,
		};
		const { api, requests } = fakeApi(200, budget);

		expect(
			await api.budgets.set(HOUSEHOLD_ID, TAG_ID, {
				period: "year",
				amount: 120_000,
				from: "2026-01",
			}),
		).toEqual(budget);
		expect(requests[0]).toMatchObject({
			url: `${base}/${TAG_ID}`,
			method: "PUT",
			body: { period: "year", amount: 120_000, from: "2026-01" },
		});
	});

	it("checks the amount before sending", async () => {
		const { api, fetch } = fakeApi(200);

		const error = await api.budgets
			.set(HOUSEHOLD_ID, TAG_ID, {
				period: "month",
				amount: 0,
				from: "2026-11",
			})
			.catch((reason: unknown) => reason);

		expect((error as ValidationError).issues).toEqual([
			{ field: "amount", message: "amount_not_positive" },
		]);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("stops a budget from a month on", async () => {
		const { api, requests } = fakeApi(204);

		await api.budgets.stop(HOUSEHOLD_ID, TAG_ID, "2027-01");

		expect(requests[0]).toMatchObject({
			url: `${base}/${TAG_ID}?from=2027-01`,
			method: "DELETE",
		});
	});

	it("gives what a tag usually costs", async () => {
		const suggestion = { tagId: TAG_ID, month: 60_000, year: 300_000 };
		const { api, requests } = fakeApi(200, suggestion);

		expect(
			await api.budgets.suggestion(HOUSEHOLD_ID, TAG_ID, { month: "2026-11" }),
		).toEqual(suggestion);
		expect(requests[0]?.url).toBe(`${base}/${TAG_ID}/suggestion?month=2026-11`);
	});

	it("types a tag from elsewhere, and a response out of contract", async () => {
		await expect(
			fakeApi(404, {
				error: { code: "not_found", message: "Not found" },
			}).api.budgets.stop(HOUSEHOLD_ID, TAG_ID, "2027-01"),
		).rejects.toBeInstanceOf(NotFoundError);
		await expect(
			fakeApi(200, {
				month: "2026-11",
				budgets: [{ tagId: TAG_ID }],
			}).api.budgets.list(HOUSEHOLD_ID),
		).rejects.toBeInstanceOf(ServerError);
	});

	it("keeps identifiers from changing the requested path", async () => {
		const { api, requests } = fakeApi(204);

		await api.budgets.stop("a/b", "../x", "2027-01");

		expect(requests[0]?.url).toBe(
			"http://api.test/v1/households/a%2Fb/budgets/..%2Fx?from=2027-01",
		);
	});
});
