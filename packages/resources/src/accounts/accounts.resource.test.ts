import { describe, expect, it } from "vitest";
import {
	ForbiddenError,
	NotFoundError,
	ServerError,
	ValidationError,
} from "../errors";
import { fakeApi } from "../test/fake-fetch";

const HOUSEHOLD_ID = "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f";
const ACCOUNT_ID = "9c8b7a6d-5e4f-4d3c-a2b1-0f9e8d7c6b5a";
const USER_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

const account = {
	id: ACCOUNT_ID,
	householdId: HOUSEHOLD_ID,
	name: "Chequing",
	type: "checking",
	visibility: "details",
	balance: 125_050,
	openingBalance: 125_050,
	holders: [{ userId: USER_ID, name: "Alice" }],
	isHolder: true,
	archived: false,
	createdAt: "2026-11-14T12:00:00.000Z",
};

const input = {
	name: "Chequing",
	type: "checking",
	visibility: "details",
	openingBalance: 125_050,
} as const;

const base = `http://api.test/v1/households/${HOUSEHOLD_ID}/accounts`;

describe("accounts", () => {
	it("lists the household's accounts as a page, without the envelope", async () => {
		const { api, requests } = fakeApi(200, {
			data: [account],
			pagination: { page: 2, pageSize: 10, total: 11 },
		});

		expect(
			await api.accounts.list(HOUSEHOLD_ID, { page: 2, pageSize: 10 }),
		).toEqual({ items: [account], page: 2, pageSize: 10, total: 11 });
		expect(requests[0]).toMatchObject({
			url: `${base}?page=2&pageSize=10`,
			method: "GET",
		});
	});

	it("accepts an account whose details the user can't see", async () => {
		const hidden = { ...account, openingBalance: null, isHolder: false };
		const { api } = fakeApi(200, hidden);

		expect(await api.accounts.get(HOUSEHOLD_ID, ACCOUNT_ID)).toEqual(hidden);
	});

	it("gets an account", async () => {
		const { api, requests } = fakeApi(200, account);

		expect(await api.accounts.get(HOUSEHOLD_ID, ACCOUNT_ID)).toEqual(account);
		expect(requests[0]?.url).toBe(`${base}/${ACCOUNT_ID}`);
	});

	it("throws a NotFoundError for an unknown account", async () => {
		const { api } = fakeApi(404, {
			error: { code: "not_found", message: "Account not found" },
		});

		await expect(
			api.accounts.get(HOUSEHOLD_ID, ACCOUNT_ID),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("keeps identifiers from changing the requested path", async () => {
		const { api, requests } = fakeApi(404);

		await api.accounts.get("a/b", "../summary").catch(() => undefined);

		expect(requests[0]?.url).toBe(
			"http://api.test/v1/households/a%2Fb/accounts/..%2Fsummary",
		);
	});

	it("rejects a response that doesn't match the contract", async () => {
		const { api } = fakeApi(200, { ...account, balance: 12.5 });

		await expect(
			api.accounts.get(HOUSEHOLD_ID, ACCOUNT_ID),
		).rejects.toBeInstanceOf(ServerError);
	});

	it("gets the household's consolidated view", async () => {
		const summary = {
			assets: 1_125_050,
			liabilities: -45_000,
			balance: 1_080_050,
		};
		const { api, requests } = fakeApi(200, summary);

		expect(await api.accounts.summary(HOUSEHOLD_ID)).toEqual(summary);
		expect(requests[0]).toMatchObject({
			url: `${base}/summary`,
			method: "GET",
		});
	});

	it("creates an account", async () => {
		const { api, requests } = fakeApi(201, account);

		expect(
			await api.accounts.create(HOUSEHOLD_ID, {
				...input,
				name: " Chequing ",
				holderIds: [USER_ID],
			}),
		).toEqual(account);
		expect(requests[0]).toMatchObject({
			url: base,
			method: "POST",
			body: { ...input, holderIds: [USER_ID] },
		});
	});

	it("rejects an invalid account before sending", async () => {
		const { api, fetch } = fakeApi(201, account);

		const error = await api.accounts
			.create(HOUSEHOLD_ID, { ...input, name: " ", openingBalance: 12.5 })
			.catch((reason: unknown) => reason);

		expect(error).toBeInstanceOf(ValidationError);
		expect((error as ValidationError).issues).toEqual([
			{ field: "name", message: "account_name_required" },
			{ field: "openingBalance", message: "amount_invalid" },
		]);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("reports the holders refused by the API next to their field", async () => {
		const { api } = fakeApi(422, {
			error: {
				code: "validation_error",
				message: "Invalid request",
				details: [{ field: "holderIds", message: "account_holders_invalid" }],
			},
		});

		const error = await api.accounts
			.create(HOUSEHOLD_ID, input)
			.catch((reason: unknown) => reason);

		expect((error as ValidationError).issues).toEqual([
			{ field: "holderIds", message: "account_holders_invalid" },
		]);
	});

	it("updates the fields given", async () => {
		const { api, requests } = fakeApi(200, {
			...account,
			visibility: "balance",
		});

		expect(
			await api.accounts.update(HOUSEHOLD_ID, ACCOUNT_ID, {
				visibility: "balance",
			}),
		).toMatchObject({ visibility: "balance" });
		expect(requests[0]).toMatchObject({
			url: `${base}/${ACCOUNT_ID}`,
			method: "PATCH",
			body: { visibility: "balance" },
		});
	});

	it("throws a ForbiddenError when the user doesn't hold the account", async () => {
		const { api } = fakeApi(403, {
			error: { code: "forbidden", message: "Holders only" },
		});

		await expect(
			api.accounts.update(HOUSEHOLD_ID, ACCOUNT_ID, { name: "Mine" }),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("removes an account", async () => {
		const { api, requests } = fakeApi(204);

		await api.accounts.remove(HOUSEHOLD_ID, ACCOUNT_ID);

		expect(requests[0]).toMatchObject({
			url: `${base}/${ACCOUNT_ID}`,
			method: "DELETE",
		});
	});

	describe("adjust", () => {
		const adjustment = {
			id: ACCOUNT_ID,
			householdId: HOUSEHOLD_ID,
			type: "expense",
			date: "2026-11-15",
			accountId: ACCOUNT_ID,
			toAccountId: null,
			amount: 12_000,
			payee: null,
			note: null,
			origin: "adjustment",
			receipt: null,
			lines: [{ id: ACCOUNT_ID, amount: 12_000, tagId: null }],
			createdBy: null,
			createdAt: "2026-11-15T12:00:00.000Z",
			updatedAt: "2026-11-15T12:00:00.000Z",
		};

		it("sends what the account really holds, and gives the gap recorded", async () => {
			const { api, requests } = fakeApi(200, { adjustment, balance: 15_000 });

			expect(
				await api.accounts.adjust(HOUSEHOLD_ID, ACCOUNT_ID, {
					balance: 15_000,
					date: "2026-11-15",
				}),
			).toEqual({ adjustment, balance: 15_000 });
			expect(requests[0]).toMatchObject({
				url: `${base}/${ACCOUNT_ID}/adjust`,
				method: "POST",
				body: { balance: 15_000, date: "2026-11-15" },
			});
		});

		it("gives no adjustment when there was no gap", async () => {
			const { api } = fakeApi(200, { adjustment: null, balance: 10_000 });

			expect(
				await api.accounts.adjust(HOUSEHOLD_ID, ACCOUNT_ID, {
					balance: 10_000,
					date: "2026-11-15",
				}),
			).toEqual({ adjustment: null, balance: 10_000 });
		});

		it("checks the day before sending", async () => {
			const { api, fetch } = fakeApi(200);

			const error = await api.accounts
				.adjust(HOUSEHOLD_ID, ACCOUNT_ID, { balance: 1, date: "15/11/2026" })
				.catch((reason: unknown) => reason);

			expect((error as ValidationError).issues).toEqual([
				{ field: "date", message: "date_invalid" },
			]);
			expect(fetch).not.toHaveBeenCalled();
		});
	});
});
