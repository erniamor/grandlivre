import { describe, expect, it } from "vitest";
import {
	ApiError,
	ForbiddenError,
	NotFoundError,
	ServerError,
	type ValidationError,
} from "../errors";
import { fakeApi } from "../test/fake-fetch";

const HOUSEHOLD_ID = "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f";
const RECURRING_ID = "9c8b7a6d-5e4f-4d3c-a2b1-0f9e8d7c6b5a";
const OCCURRENCE_ID = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e";
const ACCOUNT_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const TAG_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const NOW = "2026-11-15T12:00:00.000Z";

const base = `http://api.test/v1/households/${HOUSEHOLD_ID}/recurring-transactions`;

const input = {
	transaction: {
		type: "expense" as const,
		accountId: ACCOUNT_ID,
		payee: " Landlord ",
		lines: [{ amount: 150_000, tagId: TAG_ID }],
	},
	schedule: {
		unit: "month" as const,
		interval: 1,
		startDate: "2026-12-01",
		endDate: null,
	},
};

const recurring = {
	id: RECURRING_ID,
	householdId: HOUSEHOLD_ID,
	transaction: {
		type: "expense",
		accountId: ACCOUNT_ID,
		toAccountId: null,
		amount: 150_000,
		payee: "Landlord",
		note: null,
		lines: [{ amount: 150_000, tagId: TAG_ID }],
	},
	schedule: input.schedule,
	mode: "confirm",
	nextDate: "2026-12-01",
	createdBy: { userId: ACCOUNT_ID, name: "Alice" },
	createdAt: NOW,
	updatedAt: NOW,
};

const page = <T>(data: T[]) => ({
	data,
	pagination: { page: 1, pageSize: 50, total: data.length },
});

describe("recurring", () => {
	it("lists the recurring transactions, without the envelope", async () => {
		const { api, requests } = fakeApi(200, page([recurring]));

		expect(
			await api.recurring.list(HOUSEHOLD_ID, { page: 2, pageSize: 10 }),
		).toEqual({ items: [recurring], page: 1, pageSize: 50, total: 1 });
		expect(requests[0]?.url).toBe(`${base}?page=2&pageSize=10`);
	});

	it("creates one, its input checked and trimmed", async () => {
		const { api, requests } = fakeApi(201, recurring);

		expect(await api.recurring.create(HOUSEHOLD_ID, input)).toEqual(recurring);
		expect(requests[0]).toMatchObject({
			url: base,
			method: "POST",
			body: {
				...input,
				transaction: { ...input.transaction, payee: "Landlord" },
			},
		});
	});

	it("rejects a schedule that makes no sense before sending", async () => {
		const { api, fetch } = fakeApi(201, recurring);

		const error = await api.recurring
			.create(HOUSEHOLD_ID, {
				...input,
				schedule: { ...input.schedule, interval: 0, endDate: "2026-11-01" },
			})
			.catch((reason: unknown) => reason);

		expect((error as ValidationError).issues).toEqual(
			expect.arrayContaining([
				{ field: "schedule.interval", message: "recurrence_interval_invalid" },
			]),
		);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("reports a first day already past, on its field", async () => {
		const { api } = fakeApi(422, {
			error: {
				code: "validation_error",
				message: "Invalid request",
				details: [
					{ field: "schedule.startDate", message: "recurrence_start_in_past" },
				],
			},
		});

		const error = await api.recurring
			.create(HOUSEHOLD_ID, input)
			.catch((reason: unknown) => reason);

		expect((error as ValidationError).issues).toEqual([
			{ field: "schedule.startDate", message: "recurrence_start_in_past" },
		]);
	});

	it("reads, replaces and deletes one by its id", async () => {
		const read = fakeApi(200, recurring);
		const replaced = fakeApi(200, recurring);
		const removed = fakeApi(204);

		await read.api.recurring.get(HOUSEHOLD_ID, RECURRING_ID);
		await replaced.api.recurring.replace(HOUSEHOLD_ID, RECURRING_ID, {
			...input,
			mode: "automatic",
		});
		await removed.api.recurring.remove(HOUSEHOLD_ID, RECURRING_ID);

		expect(read.requests[0]).toMatchObject({
			url: `${base}/${RECURRING_ID}`,
			method: "GET",
		});
		expect(replaced.requests[0]).toMatchObject({
			url: `${base}/${RECURRING_ID}`,
			method: "PUT",
			body: expect.objectContaining({ mode: "automatic" }),
		});
		expect(removed.requests[0]).toMatchObject({
			url: `${base}/${RECURRING_ID}`,
			method: "DELETE",
		});
	});

	it("types what it may not see, or not change", async () => {
		await expect(
			fakeApi(404, {
				error: { code: "not_found", message: "Not found" },
			}).api.recurring.get(HOUSEHOLD_ID, RECURRING_ID),
		).rejects.toBeInstanceOf(NotFoundError);
		await expect(
			fakeApi(403, {
				error: { code: "forbidden", message: "Forbidden" },
			}).api.recurring.remove(HOUSEHOLD_ID, RECURRING_ID),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("rejects a response out of contract", async () => {
		const { api } = fakeApi(200, { ...recurring, mode: "sometimes" });

		await expect(
			api.recurring.get(HOUSEHOLD_ID, RECURRING_ID),
		).rejects.toBeInstanceOf(ServerError);
	});

	describe("the days waiting for a member", () => {
		const occurrence = { id: OCCURRENCE_ID, date: "2026-12-01", recurring };
		const expense = {
			type: "expense" as const,
			accountId: ACCOUNT_ID,
			date: "2026-12-02",
			lines: [{ amount: 8_734 }],
		};
		const transaction = {
			id: RECURRING_ID,
			householdId: HOUSEHOLD_ID,
			...expense,
			toAccountId: null,
			amount: 8_734,
			payee: null,
			note: null,
			origin: "recurring",
			receipt: null,
			lines: [{ id: TAG_ID, amount: 8_734, tagId: null }],
			createdBy: null,
			createdAt: NOW,
			updatedAt: NOW,
		};

		it("are listed", async () => {
			const { api, requests } = fakeApi(200, page([occurrence]));

			expect((await api.recurring.pending(HOUSEHOLD_ID)).items).toEqual([
				occurrence,
			]);
			expect(requests[0]?.url).toBe(`${base}/pending`);
		});

		it("are confirmed with the transaction as reviewed", async () => {
			const { api, requests } = fakeApi(201, transaction);

			expect(
				await api.recurring.confirm(HOUSEHOLD_ID, OCCURRENCE_ID, expense),
			).toEqual(transaction);
			expect(requests[0]).toMatchObject({
				url: `${base}/pending/${OCCURRENCE_ID}/confirm`,
				method: "POST",
				body: expense,
			});
		});

		it("are skipped", async () => {
			const { api, requests } = fakeApi(204);

			await api.recurring.skip(HOUSEHOLD_ID, OCCURRENCE_ID);

			expect(requests[0]).toMatchObject({
				url: `${base}/pending/${OCCURRENCE_ID}/skip`,
				method: "POST",
			});
		});

		it("report one already handled with its code", async () => {
			const { api } = fakeApi(409, {
				error: { code: "occurrence_already_handled", message: "Handled" },
			});

			const error = await api.recurring
				.skip(HOUSEHOLD_ID, OCCURRENCE_ID)
				.catch((reason: unknown) => reason);

			expect(error).toBeInstanceOf(ApiError);
			expect(error).toMatchObject({
				status: 409,
				code: "occurrence_already_handled",
			});
		});
	});

	it("lists the days to come, over the days asked", async () => {
		const { api, requests } = fakeApi(
			200,
			page([{ date: "2026-12-01", recurring }]),
		);

		expect(
			(await api.recurring.upcoming(HOUSEHOLD_ID, { days: 14 })).items,
		).toEqual([{ date: "2026-12-01", recurring }]);
		expect(requests[0]?.url).toBe(`${base}/upcoming?days=14`);
	});

	it("keeps identifiers from changing the requested path", async () => {
		const { api, requests } = fakeApi(204);

		await api.recurring.skip("a/b", "../x").catch(() => undefined);

		expect(requests[0]?.url).toBe(
			"http://api.test/v1/households/a%2Fb/recurring-transactions/pending/..%2Fx/skip",
		);
	});
});
