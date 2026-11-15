import { describe, expect, it } from "vitest";
import {
	ForbiddenError,
	NotFoundError,
	ServerError,
	ValidationError,
} from "../errors";
import { fakeApi } from "../test/fake-fetch";

const HOUSEHOLD_ID = "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f";
const ACCOUNT_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const TAG_ID = "9c8b7a6d-5e4f-4d3c-a2b1-0f9e8d7c6b5a";

const base = `http://api.test/v1/households/${HOUSEHOLD_ID}/reports`;

const tagReport = {
	from: "2026-11-01",
	to: "2026-11-30",
	tags: [
		{ tagId: TAG_ID, expense: 18_000, income: 3000 },
		{ tagId: null, expense: 1500, income: 250_000 },
	],
};

const monthlyReport = {
	months: [
		{ month: "2026-10", expense: 40_000, income: 0 },
		{ month: "2026-11", expense: 31_200, income: 253_000 },
	],
};

const november = { from: "2026-11-01", to: "2026-11-30" };

describe("reports", () => {
	it("gets what each tag gathered over a period", async () => {
		const { api, requests } = fakeApi(200, tagReport);

		expect(await api.reports.tags(HOUSEHOLD_ID, november)).toEqual(tagReport);
		expect(requests[0]).toMatchObject({
			url: `${base}/tags?from=2026-11-01&to=2026-11-30`,
			method: "GET",
		});
	});

	it("narrows a report to an account", async () => {
		const { api, requests } = fakeApi(200, tagReport);

		await api.reports.tags(HOUSEHOLD_ID, {
			...november,
			accountId: ACCOUNT_ID,
		});

		expect(requests[0]?.url).toBe(
			`${base}/tags?from=2026-11-01&to=2026-11-30&accountId=${ACCOUNT_ID}`,
		);
	});

	it("gets the months of a period, for a tag and an account when given", async () => {
		const { api, requests } = fakeApi(200, monthlyReport);

		expect(
			await api.reports.monthly(HOUSEHOLD_ID, {
				from: "2026-10-01",
				to: "2026-11-30",
			}),
		).toEqual(monthlyReport);
		await api.reports.monthly(HOUSEHOLD_ID, {
			...november,
			tagId: TAG_ID,
			accountId: ACCOUNT_ID,
		});

		expect(requests.map((request) => request.url)).toEqual([
			`${base}/monthly?from=2026-10-01&to=2026-11-30`,
			`${base}/monthly?from=2026-11-01&to=2026-11-30&tagId=${TAG_ID}&accountId=${ACCOUNT_ID}`,
		]);
	});

	it("throws a ForbiddenError for an account that only shows its balance", async () => {
		const { api } = fakeApi(403, {
			error: { code: "forbidden", message: "Balance only" },
		});

		await expect(
			api.reports.tags(HOUSEHOLD_ID, { ...november, accountId: ACCOUNT_ID }),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("reports an invalid period with its error code, on its field", async () => {
		const { api } = fakeApi(422, {
			error: {
				code: "validation_error",
				message: "Invalid request",
				details: [{ field: "to", message: "report_period_invalid" }],
			},
		});

		const error = await api.reports
			.tags(HOUSEHOLD_ID, { from: "2026-11-30", to: "2026-11-01" })
			.catch((reason: unknown) => reason);

		expect(error).toBeInstanceOf(ValidationError);
		expect((error as ValidationError).issues).toEqual([
			{ field: "to", message: "report_period_invalid" },
		]);
	});

	it("throws a NotFoundError for a household the user isn't a member of", async () => {
		const { api } = fakeApi(404, {
			error: { code: "not_found", message: "Household not found" },
		});

		await expect(
			api.reports.monthly(HOUSEHOLD_ID, november),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("rejects a report that doesn't match the contract", async () => {
		const { api } = fakeApi(200, {
			months: [{ month: "November", expense: 0, income: 0 }],
		});

		await expect(
			api.reports.monthly(HOUSEHOLD_ID, november),
		).rejects.toBeInstanceOf(ServerError);
	});

	it("keeps an identifier from changing the requested path", async () => {
		const { api, requests } = fakeApi(404);

		await api.reports.tags("../me", november).catch(() => undefined);

		expect(requests[0]?.url).toBe(
			"http://api.test/v1/households/..%2Fme/reports/tags?from=2026-11-01&to=2026-11-30",
		);
	});
});
