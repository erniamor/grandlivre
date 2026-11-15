import type { RecurringTransaction } from "@repo/schemas";
import { api, json } from "@test/helpers/api";
import {
	addTestMember,
	createTestHousehold,
	signInUser,
	type TestUser,
} from "@test/helpers/households";
import { householdApi } from "@test/helpers/transactions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
	// Only the clock: 2026-11-15 at noon in Montreal, the household's time zone
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2026-11-15T17:00:00Z"));
});

afterEach(() => {
	vi.useRealTimers();
});

/**
 * A household owned by Alice, with Bob; Carol is outside it. Alice holds
 * chequing and savings, Bob his own account, whose balance only shows.
 */
async function setUp() {
	const alice = await signInUser("alice@example.com");
	const bob = await signInUser("bob@example.com");
	const carol = await signInUser("carol@example.com");
	const household = await createTestHousehold(alice.cookie);
	await addTestMember(household.id, bob.id);
	const h = householdApi(household.id);
	const chequing = await h.account(alice, { name: "Chequing" });
	const savings = await h.account(alice, { name: "Savings", type: "savings" });
	const bobs = await h.account(bob, {
		name: "Bob's",
		visibility: "balance",
	});
	const home = await h.tag(alice, "Home");
	const base = `${h.base}/recurring-transactions`;

	const rent = {
		transaction: {
			type: "expense",
			accountId: chequing.id,
			payee: "Landlord",
			lines: [{ amount: 150_000, tagId: home.id }],
		},
		schedule: {
			unit: "month",
			interval: 1,
			startDate: "2026-12-01",
			endDate: null,
		},
	};
	const call = (
		user: TestUser | null,
		method: string,
		path = "",
		body?: unknown,
	) => api(`${base}${path}`, { method, cookie: user?.cookie, body });
	const create = (user: TestUser, body: unknown = rent) =>
		call(user, "POST", "", body);
	const created = async (body: unknown = rent) =>
		json<RecurringTransaction>(await create(alice, body));

	return {
		alice,
		bob,
		carol,
		household,
		h,
		chequing,
		savings,
		bobs,
		home,
		rent,
		call,
		create,
		created,
	};
}

describe("POST /v1/households/:householdId/recurring-transactions", () => {
	it("creates a recurring expense, to confirm each time unless told otherwise", async () => {
		const { alice, household, chequing, home, rent, create } = await setUp();

		const response = await create(alice);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({
			id: expect.any(String),
			householdId: household.id,
			transaction: {
				type: "expense",
				accountId: chequing.id,
				toAccountId: null,
				amount: 150_000,
				payee: "Landlord",
				note: null,
				lines: [{ amount: 150_000, tagId: home.id }],
			},
			schedule: rent.schedule,
			mode: "confirm",
			nextDate: "2026-12-01",
			createdBy: { userId: alice.id, name: "alice@example.com" },
			createdAt: expect.any(String),
			updatedAt: expect.any(String),
		});
	});

	it("creates an automatic transfer every two weeks, until a day", async () => {
		const { chequing, savings, created } = await setUp();

		const saving = await created({
			transaction: {
				type: "transfer",
				accountId: chequing.id,
				toAccountId: savings.id,
				amount: 20_000,
			},
			schedule: {
				unit: "week",
				interval: 2,
				startDate: "2026-11-20",
				endDate: "2027-06-30",
			},
			mode: "automatic",
		});

		expect(saving).toMatchObject({
			transaction: {
				type: "transfer",
				toAccountId: savings.id,
				amount: 20_000,
			},
			schedule: { unit: "week", interval: 2, endDate: "2027-06-30" },
			mode: "automatic",
			nextDate: "2026-11-20",
		});
	});

	it("starts today at the earliest, in the household's time zone", async () => {
		const { alice, household, rent, create } = await setUp();
		const startingOn = (startDate: string) =>
			create(alice, { ...rent, schedule: { ...rent.schedule, startDate } });

		// 01:00 UTC on the 16th: still the 15th in Montreal
		vi.setSystemTime(new Date("2026-11-16T01:00:00Z"));
		const today = await startingOn("2026-11-15");
		const yesterday = await startingOn("2026-11-14");
		// Already the 16th in Paris
		await api(`/v1/households/${household.id}`, {
			method: "PATCH",
			cookie: alice.cookie,
			body: { timeZone: "Europe/Paris" },
		});
		const pastInParis = await startingOn("2026-11-15");

		expect(today.status).toBe(201);
		expect(yesterday.status).toBe(422);
		expect(await yesterday.json()).toMatchObject({
			error: {
				details: [
					{ field: "schedule.startDate", message: "recurrence_start_in_past" },
				],
			},
		});
		expect(pastInParis.status).toBe(422);
	});

	it("rejects a schedule that makes no sense, with a code per field", async () => {
		const { alice, rent, create } = await setUp();

		const response = await create(alice, {
			...rent,
			schedule: {
				unit: "day",
				interval: 0,
				startDate: "2026-12-01",
				endDate: null,
			},
			mode: "sometimes",
		});
		const endsBefore = await create(alice, {
			...rent,
			schedule: { ...rent.schedule, endDate: "2026-11-30" },
		});

		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({
			error: {
				details: expect.arrayContaining([
					{ field: "schedule.unit", message: "recurrence_unit_invalid" },
					{
						field: "schedule.interval",
						message: "recurrence_interval_invalid",
					},
					{ field: "mode", message: "recurrence_mode_invalid" },
				]),
			},
		});
		expect(await endsBefore.json()).toMatchObject({
			error: {
				details: [
					{ field: "schedule.endDate", message: "recurrence_end_before_start" },
				],
			},
		});
	});

	it("checks what it records as a transaction, pointing into it", async () => {
		const { alice, rent, create } = await setUp();
		const foreign = "00000000-0000-4000-8000-000000000001";

		const unknownTag = await create(alice, {
			...rent,
			transaction: {
				...rent.transaction,
				lines: [{ amount: 100, tagId: foreign }],
			},
		});
		const unknownAccount = await create(alice, {
			...rent,
			transaction: { ...rent.transaction, accountId: foreign },
		});
		const withADate = await create(alice, {
			...rent,
			transaction: { ...rent.transaction, date: "2026-12-01" },
		});

		expect(await unknownTag.json()).toMatchObject({
			error: {
				details: [
					{
						field: "transaction.lines.0.tagId",
						message: "transaction_tag_invalid",
					},
				],
			},
		});
		expect(await unknownAccount.json()).toMatchObject({
			error: {
				details: [
					{
						field: "transaction.accountId",
						message: "transaction_account_invalid",
					},
				],
			},
		});
		expect(withADate.status).toBe(422);
	});

	it("is only for a holder of the account, and hides the household from outsiders", async () => {
		const { bob, carol, create, call } = await setUp();

		expect((await create(bob)).status).toBe(403);
		expect((await create(carol)).status).toBe(404);
		expect((await call(null, "POST", "", {})).status).toBe(401);
	});

	it("refuses an archived account", async () => {
		const { alice, h, chequing, create } = await setUp();
		await h.updateAccount(alice, chequing.id, { archived: true });

		const response = await create(alice);

		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({
			error: { code: "account_archived" },
		});
	});
});

describe("GET /v1/households/:householdId/recurring-transactions", () => {
	it("lists the next due first, ended ones last, to the members who see their accounts", async () => {
		const { alice, bob, bobs, rent, call, created, create } = await setUp();
		const later = await created({
			...rent,
			schedule: { ...rent.schedule, startDate: "2027-01-15" },
		});
		const sooner = await created({
			...rent,
			schedule: { ...rent.schedule, startDate: "2026-11-20" },
		});
		await create(bob, {
			...rent,
			transaction: {
				...rent.transaction,
				accountId: bobs.id,
				lines: [{ amount: 900 }],
			},
		});

		const forAlice = await json<{
			data: RecurringTransaction[];
			pagination: unknown;
		}>(await call(alice, "GET"));
		const forBob = await json<{ data: RecurringTransaction[] }>(
			await call(bob, "GET"),
		);

		// Bob's account shows only its balance to Alice
		expect(forAlice.data.map((recurring) => recurring.id)).toEqual([
			sooner.id,
			later.id,
		]);
		expect(forAlice.pagination).toEqual({ page: 1, pageSize: 50, total: 2 });
		expect(forBob.data).toHaveLength(3);
	});

	it("shows one, as if it didn't exist to whom can't see its account", async () => {
		const { alice, bob, carol, bobs, rent, call, create, created } =
			await setUp();
		const mine = await created();
		const bobsOwn = await json<RecurringTransaction>(
			await create(bob, {
				...rent,
				transaction: {
					...rent.transaction,
					accountId: bobs.id,
					lines: [{ amount: 900 }],
				},
			}),
		);

		expect(await (await call(bob, "GET", `/${mine.id}`)).json()).toEqual(mine);
		expect((await call(alice, "GET", `/${bobsOwn.id}`)).status).toBe(404);
		expect((await call(carol, "GET", `/${mine.id}`)).status).toBe(404);
	});
});

describe("PUT /v1/households/:householdId/recurring-transactions/:recurringId", () => {
	it("changes what it records next, keeping its next day", async () => {
		const { alice, rent, call, created } = await setUp();
		const recurring = await created();

		const response = await call(alice, "PUT", `/${recurring.id}`, {
			...rent,
			transaction: { ...rent.transaction, lines: [{ amount: 155_000 }] },
			mode: "automatic",
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			transaction: {
				amount: 155_000,
				lines: [{ amount: 155_000, tagId: null }],
			},
			mode: "automatic",
			nextDate: "2026-12-01",
		});
	});

	it("starts a new schedule on its first day, never past", async () => {
		const { alice, rent, call, created } = await setUp();
		const recurring = await created();
		const reschedule = (startDate: string) =>
			call(alice, "PUT", `/${recurring.id}`, {
				...rent,
				schedule: { ...rent.schedule, startDate },
			});

		expect(await (await reschedule("2026-12-15")).json()).toMatchObject({
			schedule: { startDate: "2026-12-15" },
			nextDate: "2026-12-15",
		});
		expect((await reschedule("2026-11-01")).status).toBe(422);
	});

	it("keeps its next day when only its last day changes", async () => {
		const { alice, rent, call, created } = await setUp();
		const recurring = await created();

		const response = await call(alice, "PUT", `/${recurring.id}`, {
			...rent,
			schedule: { ...rent.schedule, endDate: "2027-12-01" },
		});

		expect(await response.json()).toMatchObject({
			schedule: { startDate: "2026-12-01", endDate: "2027-12-01" },
			nextDate: "2026-12-01",
		});
	});

	it("is only for a holder of its account", async () => {
		const { bob, carol, rent, call, created } = await setUp();
		const recurring = await created();

		expect((await call(bob, "PUT", `/${recurring.id}`, rent)).status).toBe(403);
		expect((await call(carol, "PUT", `/${recurring.id}`, rent)).status).toBe(
			404,
		);
	});
});

describe("DELETE /v1/households/:householdId/recurring-transactions/:recurringId", () => {
	it("deletes it, for a holder of its account only", async () => {
		const { alice, bob, call, created } = await setUp();
		const recurring = await created();

		expect((await call(bob, "DELETE", `/${recurring.id}`)).status).toBe(403);
		expect((await call(alice, "DELETE", `/${recurring.id}`)).status).toBe(204);
		expect((await call(alice, "GET", `/${recurring.id}`)).status).toBe(404);
	});
});

describe("what a recurring transaction holds on to", () => {
	it("keeps its tag from being deleted", async () => {
		const { alice, h, home, created } = await setUp();
		await created();

		const response = await api(`${h.base}/tags/${home.id}`, {
			method: "DELETE",
			cookie: alice.cookie,
		});

		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({
			error: { code: "tag_in_use" },
		});
	});

	it("goes with an account deleted before it had any transaction", async () => {
		const { alice, h, chequing, call, created } = await setUp();
		const recurring = await created();

		const deleted = await api(`${h.base}/accounts/${chequing.id}`, {
			method: "DELETE",
			cookie: alice.cookie,
		});

		expect(deleted.status).toBe(204);
		expect((await call(alice, "GET", `/${recurring.id}`)).status).toBe(404);
	});
});
