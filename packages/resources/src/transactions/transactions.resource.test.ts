import { describe, expect, it } from "vitest";
import {
	ApiError,
	ForbiddenError,
	NotFoundError,
	RateLimitError,
	ServerError,
	ValidationError,
} from "../errors";
import { fakeApi } from "../test/fake-fetch";

const HOUSEHOLD_ID = "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f";
const TRANSACTION_ID = "9c8b7a6d-5e4f-4d3c-a2b1-0f9e8d7c6b5a";
const ACCOUNT_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const OTHER_ACCOUNT_ID = "7d6c5b4a-3f2e-4d1c-8b0a-9f8e7d6c5b4a";
const TAG_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const NOW = "2026-11-14T12:00:00.000Z";

const transaction = {
	id: TRANSACTION_ID,
	householdId: HOUSEHOLD_ID,
	type: "expense",
	date: "2026-11-14",
	accountId: ACCOUNT_ID,
	toAccountId: null,
	amount: 7200,
	payee: "Shell",
	note: null,
	origin: "manual",
	lines: [
		{ id: "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f", amount: 7200, tagId: TAG_ID },
	],
	createdBy: { userId: "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9", name: "Alice" },
	createdAt: NOW,
	updatedAt: NOW,
};

const expense = {
	// Only the type is narrowed: the lines stay an ordinary, writable array
	type: "expense" as const,
	accountId: ACCOUNT_ID,
	date: "2026-11-14",
	lines: [{ amount: 7200, tagId: TAG_ID }],
};

const base = `http://api.test/v1/households/${HOUSEHOLD_ID}/transactions`;

describe("transactions", () => {
	it("lists the transactions as a page, without the envelope", async () => {
		const { api, requests } = fakeApi(200, {
			data: [transaction],
			pagination: { page: 2, pageSize: 10, total: 11 },
		});

		expect(
			await api.transactions.list(HOUSEHOLD_ID, { page: 2, pageSize: 10 }),
		).toEqual({ items: [transaction], page: 2, pageSize: 10, total: 11 });
		expect(requests[0]).toMatchObject({
			url: `${base}?page=2&pageSize=10`,
			method: "GET",
		});
	});

	it("sends the filters given, and only those", async () => {
		const { api, requests } = fakeApi(200, {
			data: [],
			pagination: { page: 1, pageSize: 50, total: 0 },
		});

		await api.transactions.list(HOUSEHOLD_ID, {
			accountId: ACCOUNT_ID,
			type: "expense",
			from: "2026-11-01",
			to: "2026-11-30",
		});
		await api.transactions.list(HOUSEHOLD_ID, { tagId: TAG_ID });
		await api.transactions.list(HOUSEHOLD_ID);

		expect(requests.map((request) => request.url)).toEqual([
			`${base}?accountId=${ACCOUNT_ID}&type=expense&from=2026-11-01&to=2026-11-30`,
			`${base}?tagId=${TAG_ID}`,
			base,
		]);
	});

	it("gets a transaction", async () => {
		const { api, requests } = fakeApi(200, transaction);

		expect(await api.transactions.get(HOUSEHOLD_ID, TRANSACTION_ID)).toEqual(
			transaction,
		);
		expect(requests[0]?.url).toBe(`${base}/${TRANSACTION_ID}`);
	});

	it("accepts a transfer, and a transaction whose author is gone", async () => {
		const transfer = {
			...transaction,
			type: "transfer",
			toAccountId: OTHER_ACCOUNT_ID,
			payee: null,
			lines: [],
			createdBy: null,
		};
		const { api } = fakeApi(200, transfer);

		expect(await api.transactions.get(HOUSEHOLD_ID, TRANSACTION_ID)).toEqual(
			transfer,
		);
	});

	it("throws a NotFoundError for a transaction the user may not see", async () => {
		const { api } = fakeApi(404, {
			error: { code: "not_found", message: "Transaction not found" },
		});

		await expect(
			api.transactions.get(HOUSEHOLD_ID, TRANSACTION_ID),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("rejects a response that doesn't match the contract", async () => {
		const { api } = fakeApi(200, { ...transaction, date: "14/11/2026" });

		await expect(
			api.transactions.get(HOUSEHOLD_ID, TRANSACTION_ID),
		).rejects.toBeInstanceOf(ServerError);
	});

	it("records an expense", async () => {
		const { api, requests } = fakeApi(201, transaction);

		expect(
			await api.transactions.create(HOUSEHOLD_ID, {
				...expense,
				payee: " Shell ",
			}),
		).toEqual(transaction);
		expect(requests[0]).toMatchObject({
			url: base,
			method: "POST",
			body: { ...expense, payee: "Shell" },
		});
	});

	it("records a transfer, and where a transaction comes from", async () => {
		const { api, requests } = fakeApi(201, transaction);
		const transfer = {
			type: "transfer" as const,
			accountId: ACCOUNT_ID,
			toAccountId: OTHER_ACCOUNT_ID,
			date: "2026-11-14",
			amount: 30_000,
		};

		await api.transactions.create(HOUSEHOLD_ID, transfer);
		await api.transactions.create(HOUSEHOLD_ID, {
			...expense,
			origin: "receipt" as const,
		});

		expect(requests[0]?.body).toEqual(transfer);
		expect(requests[1]?.body).toEqual({ ...expense, origin: "receipt" });
	});

	it("rejects an invalid transaction before sending, with the fields concerned", async () => {
		const { api, fetch } = fakeApi(201, transaction);

		const error = await api.transactions
			.create(HOUSEHOLD_ID, {
				...expense,
				date: "14/11/2026",
				lines: [{ amount: 0 }],
			})
			.catch((reason: unknown) => reason);

		expect(error).toBeInstanceOf(ValidationError);
		expect((error as ValidationError).issues).toEqual([
			{ field: "date", message: "date_invalid" },
			{ field: "lines.0.amount", message: "amount_not_positive" },
		]);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("reports a tag refused by the API on its line", async () => {
		const { api } = fakeApi(422, {
			error: {
				code: "validation_error",
				message: "Invalid request",
				details: [
					{ field: "lines.0.tagId", message: "transaction_tag_invalid" },
				],
			},
		});

		const error = await api.transactions
			.create(HOUSEHOLD_ID, expense)
			.catch((reason: unknown) => reason);

		expect((error as ValidationError).issues).toEqual([
			{ field: "lines.0.tagId", message: "transaction_tag_invalid" },
		]);
	});

	it("throws a ForbiddenError when the user doesn't hold the account", async () => {
		const { api } = fakeApi(403, {
			error: { code: "forbidden", message: "Holders only" },
		});

		await expect(
			api.transactions.create(HOUSEHOLD_ID, expense),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("reports an archived account with its error code", async () => {
		const { api } = fakeApi(409, {
			error: { code: "account_archived", message: "Archived" },
		});

		const error = await api.transactions
			.create(HOUSEHOLD_ID, expense)
			.catch((reason: unknown) => reason);

		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({ status: 409, code: "account_archived" });
	});

	it("replaces a transaction as a whole", async () => {
		const { api, requests } = fakeApi(200, transaction);

		expect(
			await api.transactions.replace(HOUSEHOLD_ID, TRANSACTION_ID, expense),
		).toEqual(transaction);
		expect(requests[0]).toMatchObject({
			url: `${base}/${TRANSACTION_ID}`,
			method: "PUT",
			body: expense,
		});
	});

	it("can't change where a transaction comes from", async () => {
		const { api, fetch } = fakeApi(200, transaction);

		await expect(
			api.transactions.replace(HOUSEHOLD_ID, TRANSACTION_ID, {
				...expense,
				origin: "import",
			} as never),
		).rejects.toBeInstanceOf(ValidationError);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("removes a transaction", async () => {
		const { api, requests } = fakeApi(204);

		await api.transactions.remove(HOUSEHOLD_ID, TRANSACTION_ID);

		expect(requests[0]).toMatchObject({
			url: `${base}/${TRANSACTION_ID}`,
			method: "DELETE",
		});
	});

	it("keeps identifiers from changing the requested path", async () => {
		const { api, requests } = fakeApi(404);

		await api.transactions.get("a/b", "../accounts").catch(() => undefined);

		expect(requests[0]?.url).toBe(
			"http://api.test/v1/households/a%2Fb/transactions/..%2Faccounts",
		);
	});

	describe("draft", () => {
		const draft = {
			type: "expense",
			date: "2026-11-14",
			accountId: ACCOUNT_ID,
			toAccountId: null,
			payee: "Shell",
			note: null,
			lines: [{ amount: 7240, tagId: null, usesProposedTag: true }],
			proposedTag: {
				names: { en: "Tolls", fr: "Péages", es: "Peajes" },
				parentId: TAG_ID,
				similarTags: [{ tagId: TAG_ID, reason: "contains" }],
			},
			remark: null,
		};

		it("turns a note into a draft, without the envelope", async () => {
			const { api, requests } = fakeApi(200, draft);

			expect(
				await api.transactions.draft(HOUSEHOLD_ID, {
					text: " péage 72,40 hier ",
					today: "2026-11-15",
				}),
			).toEqual(draft);
			expect(requests[0]).toMatchObject({
				url: `${base}/draft`,
				method: "POST",
				body: { text: "péage 72,40 hier", today: "2026-11-15" },
				headers: { "accept-language": "fr" },
			});
		});

		it("rejects an empty note before sending", async () => {
			const { api, fetch } = fakeApi(200, draft);

			const error = await api.transactions
				.draft(HOUSEHOLD_ID, { text: " ", today: "2026-11-15" })
				.catch((reason: unknown) => reason);

			expect((error as ValidationError).issues).toEqual([
				{ field: "text", message: "draft_text_required" },
			]);
			expect(fetch).not.toHaveBeenCalled();
		});

		it("reports a note it couldn't read, and an unavailable assistant, with their codes", async () => {
			for (const [status, code] of [
				[422, "draft_not_understood"],
				[503, "assistant_unavailable"],
			] as const) {
				const { api } = fakeApi(status, { error: { code, message: code } });

				await expect(
					api.transactions.draft(HOUSEHOLD_ID, {
						text: "gas 72",
						today: "2026-11-15",
					}),
				).rejects.toMatchObject({ status, code });
			}
		});

		it("throws a RateLimitError beyond the notes allowed per hour", async () => {
			const { api } = fakeApi(429, {
				error: { code: "too_many_requests", message: "Too many" },
			});

			await expect(
				api.transactions.draft(HOUSEHOLD_ID, {
					text: "gas 72",
					today: "2026-11-15",
				}),
			).rejects.toBeInstanceOf(RateLimitError);
		});

		it("rejects a draft that doesn't match the contract", async () => {
			const { api } = fakeApi(200, { ...draft, lines: [] });

			await expect(
				api.transactions.draft(HOUSEHOLD_ID, {
					text: "gas 72",
					today: "2026-11-15",
				}),
			).rejects.toBeInstanceOf(ServerError);
		});
	});
});
