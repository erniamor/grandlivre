import type {
	PendingOccurrence,
	RecurringTransaction,
	Transaction,
	UpcomingOccurrence,
} from "@repo/schemas";
import { api, json } from "@test/helpers/api";
import {
	addTestMember,
	createTestHousehold,
	signInUser,
	type TestUser,
} from "@test/helpers/households";
import { householdApi } from "@test/helpers/transactions";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { recurringOccurrences } from "@/db/schema";
import { runDueRecurrences } from "@/routes/recurring/recurring-runner";

/** Midnight passed in Montreal (UTC-5 in winter) on `day`, plus `hours`. */
const montreal = (day: string, hours = 1) =>
	new Date(new Date(`${day}T05:00:00Z`).getTime() + hours * 3_600_000);

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2026-11-15T17:00:00Z"));
});

afterEach(() => {
	vi.useRealTimers();
});

type Page<T> = { data: T[]; pagination: { total: number } };

/** A household of Alice and Bob; Alice holds chequing, Bob his own account. */
async function setUp() {
	const alice = await signInUser("alice@example.com");
	const bob = await signInUser("bob@example.com");
	const carol = await signInUser("carol@example.com");
	const household = await createTestHousehold(alice.cookie);
	await addTestMember(household.id, bob.id);
	const h = householdApi(household.id);
	const chequing = await h.account(alice, { name: "Chequing" });
	const bobs = await h.account(bob, { name: "Bob's", visibility: "balance" });
	const home = await h.tag(alice, "Home");
	const base = `${h.base}/recurring-transactions`;

	const call = (user: TestUser, method: string, path = "", body?: unknown) =>
		api(`${base}${path}`, { method, cookie: user.cookie, body });
	const recurring = async (
		fields: {
			mode?: string;
			startDate?: string;
			endDate?: string | null;
			unit?: string;
			accountId?: string;
			user?: TestUser;
		} = {},
	) =>
		json<RecurringTransaction>(
			await call(fields.user ?? alice, "POST", "", {
				transaction: {
					type: "expense",
					accountId: fields.accountId ?? chequing.id,
					payee: "Landlord",
					lines: [{ amount: 150_000, tagId: home.id }],
				},
				schedule: {
					unit: fields.unit ?? "month",
					interval: 1,
					startDate: fields.startDate ?? "2026-11-20",
					endDate: fields.endDate ?? null,
				},
				mode: fields.mode ?? "automatic",
			}),
		);
	const transactions = async () =>
		(await json<Page<Transaction>>(await h.list(alice))).data;
	const pending = async (user: TestUser = alice) =>
		(await json<Page<PendingOccurrence>>(await call(user, "GET", "/pending")))
			.data;

	return {
		alice,
		bob,
		carol,
		h,
		chequing,
		bobs,
		home,
		call,
		recurring,
		transactions,
		pending,
	};
}

describe("runDueRecurrences", () => {
	it("records an automatic one on its day, in the household's time zone, as its creator", async () => {
		const { alice, home, call, recurring, transactions } = await setUp();
		const rent = await recurring();

		// 22:00 on the 19th in Montreal: already the 20th in UTC, not here
		const early = await runDueRecurrences(montreal("2026-11-20", -2));
		const onTime = await runDueRecurrences(montreal("2026-11-20"));

		expect(early).toEqual({ recorded: 0, pending: 0 });
		expect(onTime).toEqual({ recorded: 1, pending: 0 });
		expect(await transactions()).toMatchObject([
			{
				type: "expense",
				date: "2026-11-20",
				payee: "Landlord",
				amount: 150_000,
				lines: [{ amount: 150_000, tagId: home.id }],
				origin: "recurring",
				createdBy: { userId: alice.id },
			},
		]);
		expect(
			await (await call(alice, "GET", `/${rent.id}`)).json(),
		).toMatchObject({ nextDate: "2026-12-20" });
	});

	it("records each day only once, run again or twice at a time", async () => {
		const { recurring, transactions } = await setUp();
		await recurring();
		const now = montreal("2026-11-20");

		await Promise.all([runDueRecurrences(now), runDueRecurrences(now)]);
		await runDueRecurrences(now);

		expect(await transactions()).toHaveLength(1);
	});

	it("catches up on the days missed while nothing ran", async () => {
		const { recurring, transactions } = await setUp();
		await recurring({ startDate: "2026-11-30" });

		const summary = await runDueRecurrences(montreal("2027-03-01"));

		expect(summary.recorded).toBe(4);
		expect(
			(await transactions()).map((transaction) => transaction.date),
		).toEqual(["2027-02-28", "2027-01-30", "2026-12-30", "2026-11-30"]);
	});

	it("stops after its last day", async () => {
		const { alice, call, recurring, transactions } = await setUp();
		const loan = await recurring({ endDate: "2026-12-20" });

		await runDueRecurrences(montreal("2027-06-01"));

		expect(await transactions()).toHaveLength(2);
		expect(
			await (await call(alice, "GET", `/${loan.id}`)).json(),
		).toMatchObject({ nextDate: null });
	});

	it("sets aside one to confirm, recording nothing", async () => {
		const { recurring, transactions, pending } = await setUp();
		const bill = await recurring({ mode: "confirm" });

		const summary = await runDueRecurrences(montreal("2026-12-21"));

		expect(summary).toEqual({ recorded: 0, pending: 2 });
		expect(await transactions()).toEqual([]);
		expect(await pending()).toMatchObject([
			{ date: "2026-11-20", recurring: { id: bill.id } },
			{ date: "2026-12-20", recurring: { id: bill.id } },
		]);
	});

	it("sets aside an automatic one its account can't take, for a member to decide", async () => {
		const { alice, h, chequing, recurring, transactions, pending } =
			await setUp();
		await recurring();
		await h.updateAccount(alice, chequing.id, { archived: true });

		await runDueRecurrences(montreal("2026-11-20"));

		expect(await transactions()).toEqual([]);
		expect(await pending()).toHaveLength(1);
	});

	it("leaves a day already handled as it is", async () => {
		const { recurring, transactions } = await setUp();
		const rent = await recurring();
		await db.insert(recurringOccurrences).values({
			recurringId: rent.id,
			householdId: rent.householdId,
			date: "2026-11-20",
			status: "skipped",
		});

		await runDueRecurrences(montreal("2026-11-20"));

		expect(await transactions()).toEqual([]);
	});
});

describe("the days waiting for a member", () => {
	async function waiting() {
		const setup = await setUp();
		await setup.recurring({ mode: "confirm" });
		await runDueRecurrences(montreal("2026-11-20"));
		const [occurrence] = await setup.pending();
		if (!occurrence) {
			throw new Error("Nothing waits");
		}
		return { ...setup, occurrence };
	}

	it("are recorded as the member reviewed them", async () => {
		const { alice, chequing, call, occurrence, transactions, pending } =
			await waiting();

		const response = await call(
			alice,
			"POST",
			`/pending/${occurrence.id}/confirm`,
			{
				type: "expense",
				accountId: chequing.id,
				date: "2026-11-21",
				payee: "Hydro",
				lines: [{ amount: 8_734 }],
			},
		);

		expect(response.status).toBe(201);
		expect(await response.json()).toMatchObject({
			date: "2026-11-21",
			amount: 8_734,
			origin: "recurring",
		});
		expect(await transactions()).toHaveLength(1);
		expect(await pending()).toEqual([]);
		const [row] = await db
			.select()
			.from(recurringOccurrences)
			.where(eq(recurringOccurrences.id, occurrence.id));
		expect(row).toMatchObject({
			status: "recorded",
			transactionId: expect.any(String),
		});
	});

	it("can be skipped, once", async () => {
		const { alice, call, occurrence, transactions, pending } = await waiting();

		const skipped = await call(alice, "POST", `/pending/${occurrence.id}/skip`);
		const again = await call(alice, "POST", `/pending/${occurrence.id}/skip`);

		expect(skipped.status).toBe(204);
		expect(again.status).toBe(409);
		expect(await again.json()).toMatchObject({
			error: { code: "occurrence_already_handled" },
		});
		expect(await pending()).toEqual([]);
		expect(await transactions()).toEqual([]);
	});

	it("are handled by a holder of the account, and hidden from outsiders", async () => {
		const { bob, carol, chequing, call, occurrence } = await waiting();
		const body = {
			type: "expense",
			accountId: chequing.id,
			date: "2026-11-20",
			lines: [{ amount: 100 }],
		};

		expect(
			(await call(bob, "POST", `/pending/${occurrence.id}/confirm`, body))
				.status,
		).toBe(403);
		expect(
			(await call(bob, "POST", `/pending/${occurrence.id}/skip`)).status,
		).toBe(403);
		expect(
			(await call(carol, "POST", `/pending/${occurrence.id}/skip`)).status,
		).toBe(404);
	});

	it("of an account showing only its balance stay hidden from the other members", async () => {
		const { alice, bob, bobs, recurring, pending } = await setUp();
		await recurring({ mode: "confirm", accountId: bobs.id, user: bob });

		await runDueRecurrences(montreal("2026-11-20"));

		expect(await pending(bob)).toHaveLength(1);
		expect(await pending(alice)).toEqual([]);
	});
});

describe("GET /v1/households/:householdId/recurring-transactions/upcoming", () => {
	it("lists the days to come, the soonest first, over the days asked", async () => {
		const { alice, call, recurring } = await setUp();
		const rent = await recurring({ startDate: "2026-12-01" });
		const pay = await recurring({ startDate: "2026-11-20", unit: "week" });

		const page = await json<Page<UpcomingOccurrence>>(
			await call(alice, "GET", "/upcoming?days=16"),
		);

		expect(
			page.data.map(({ date, recurring }) => [date, recurring.id]),
		).toEqual([
			["2026-11-20", pay.id],
			["2026-11-27", pay.id],
			["2026-12-01", rent.id],
		]);
		expect(page.pagination.total).toBe(3);
	});

	it("goes 90 days ahead at most", async () => {
		const { alice, call } = await setUp();

		expect((await call(alice, "GET", "/upcoming?days=91")).status).toBe(422);
	});
});
