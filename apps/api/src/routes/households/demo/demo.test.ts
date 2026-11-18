import type {
	Account,
	Budget,
	Household,
	Paginated,
	PendingOccurrence,
	RecurringTransaction,
	Transaction,
	UncategorizedPayee,
} from "@repo/schemas";
import { api, json } from "@test/helpers/api";
import { openEvents } from "@test/helpers/events";
import {
	addTestMember,
	createTestHousehold,
	signInUser,
	type TestUser,
} from "@test/helpers/households";
import { describe, expect, it, vi } from "vitest";

const createDemo = (user: TestUser | null, body: unknown = {}) =>
	api("/v1/households/demo", {
		method: "POST",
		cookie: user?.cookie,
		body,
		headers: { "Accept-Language": "fr" },
	});

const householdsOf = async (user: TestUser) =>
	json<Paginated<Household>>(
		await api("/v1/households?pageSize=50", { cookie: user.cookie }),
	);

const read = async <T>(user: TestUser, path: string) =>
	json<T>(await api(path, { cookie: user.cookie }));

describe("POST /v1/households/demo", () => {
	it("makes the user a demo household of made-up data, in their language", async () => {
		const alice = await signInUser("alice@example.com");

		const response = await createDemo(alice, { timeZone: "America/Toronto" });

		expect(response.status).toBe(201);
		const demo = await json<Household>(response);
		expect(demo).toMatchObject({
			name: "Foyer de démo",
			currency: "CAD",
			timeZone: "America/Toronto",
			demo: true,
			role: "owner",
		});
		const base = `/v1/households/${demo.id}`;
		const accounts = await read<Paginated<Account>>(alice, `${base}/accounts`);
		expect(accounts.data.map(({ name, type }) => [name, type])).toEqual(
			expect.arrayContaining([
				["Compte courant", "checking"],
				["Épargne", "savings"],
				["Carte de crédit", "credit_card"],
				["Portefeuille", "cash"],
			]),
		);
		// The card owes what it spent since its last payment
		expect(
			accounts.data.find(({ type }) => type === "credit_card")?.balance,
		).toBeLessThan(0);
		const transactions = await read<Paginated<Transaction>>(
			alice,
			`${base}/transactions?pageSize=1`,
		);
		expect(transactions.pagination.total).toBeGreaterThan(150);
		const recurring = await read<Paginated<RecurringTransaction>>(
			alice,
			`${base}/recurring-transactions`,
		);
		expect(recurring.data).toHaveLength(5);
		const pending = await read<Paginated<PendingOccurrence>>(
			alice,
			`${base}/recurring-transactions/pending`,
		);
		expect(
			pending.data.map(({ recurring }) => recurring.transaction.payee),
		).toEqual(["Énergie Plus"]);
		const month = new Date().toISOString().slice(0, 7);
		const budgets = await read<{ budgets: Budget[] }>(
			alice,
			`${base}/budgets?month=${month}`,
		);
		expect(budgets.budgets).toHaveLength(3);
		const uncategorized = await read<Paginated<UncategorizedPayee>>(
			alice,
			`${base}/transactions/uncategorized`,
		);
		expect(uncategorized.data.map(({ payee }) => payee).sort()).toEqual([
			"Librairie Pages",
			"Quincaillerie Delorme",
		]);
	});

	it("is in the currency asked, and keeps the user's real households", async () => {
		const alice = await signInUser("alice@example.com");
		await createTestHousehold(alice.cookie);

		const demo = await json<Household>(
			await createDemo(alice, { currency: "EUR" }),
		);

		expect(demo.currency).toBe("EUR");
		const mine = await householdsOf(alice);
		expect(mine.data.map(({ demo }) => demo ?? false)).toEqual([false, true]);
	});

	it("replaces the user's previous demo household, and nobody else's", async () => {
		const alice = await signInUser("alice@example.com");
		const bob = await signInUser("bob@example.com");
		const first = await json<Household>(await createDemo(alice));
		const bobs = await json<Household>(await createDemo(bob));

		const second = await json<Household>(await createDemo(alice));

		const mine = await householdsOf(alice);
		expect(mine.data.map(({ id }) => id)).toEqual([second.id]);
		expect(
			(await api(`/v1/households/${first.id}`, { cookie: alice.cookie }))
				.status,
		).toBe(404);
		expect((await householdsOf(bob)).data.map(({ id }) => id)).toEqual([
			bobs.id,
		]);
	});

	it("requires a session and a valid currency", async () => {
		const alice = await signInUser("alice@example.com");

		expect((await createDemo(null)).status).toBe(401);
		expect((await createDemo(alice, { currency: "XYZ" })).status).toBe(422);
	});
});

describe("DELETE /v1/households/:householdId", () => {
	it("deletes a demo household and everything in it, for its owner", async () => {
		const alice = await signInUser("alice@example.com");
		const demo = await json<Household>(await createDemo(alice));

		const response = await api(`/v1/households/${demo.id}`, {
			method: "DELETE",
			cookie: alice.cookie,
		});

		expect(response.status).toBe(204);
		expect((await householdsOf(alice)).data).toEqual([]);
	});

	it("closes its members' event streams, so their pages go to another household", async () => {
		const alice = await signInUser("alice@example.com");
		const demo = await json<Household>(await createDemo(alice));
		const stream = await openEvents(demo.id, alice.cookie);

		await api(`/v1/households/${demo.id}`, {
			method: "DELETE",
			cookie: alice.cookie,
		});

		// No longer a member of anything there: the stream stops, and the
		// front end goes to another household
		await vi.waitFor(() => expect(stream.ended()).toBe(true));
		await stream.close();
	});

	it("never deletes a real household, and lets only an owner delete a demo one", async () => {
		const alice = await signInUser("alice@example.com");
		const bob = await signInUser("bob@example.com");
		const carol = await signInUser("carol@example.com");
		const real = await createTestHousehold(alice.cookie);
		const demo = await json<Household>(await createDemo(alice));
		await addTestMember(demo.id, bob.id);
		const remove = (user: TestUser | null, id: string) =>
			api(`/v1/households/${id}`, { method: "DELETE", cookie: user?.cookie });

		const refused = await remove(alice, real.id);
		expect(refused.status).toBe(409);
		expect(await refused.json()).toMatchObject({
			error: { code: "household_not_demo" },
		});
		expect((await remove(bob, demo.id)).status).toBe(403);
		expect((await remove(carol, demo.id)).status).toBe(404);
		expect((await remove(null, demo.id)).status).toBe(401);
		expect((await householdsOf(alice)).data).toHaveLength(2);
	});
});
