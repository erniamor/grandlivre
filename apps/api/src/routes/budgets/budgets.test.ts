import type { BudgetSuggestion, BudgetsMonth } from "@repo/schemas";
import { api, json } from "@test/helpers/api";
import {
	addTestMember,
	createTestHousehold,
	signInUser,
	type TestUser,
} from "@test/helpers/households";
import { householdApi } from "@test/helpers/transactions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDueRecurrences } from "@/routes/recurring/recurring-runner";

beforeEach(() => {
	// Only the clock: November 15th, 2026, at noon in Montreal
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2026-11-15T17:00:00Z"));
});

afterEach(() => {
	vi.useRealTimers();
});

/**
 * A household of Alice and Bob; Carol is outside it. Alice holds chequing;
 * Bob his card, whose transactions Alice doesn't see. Tags: Food › Groceries,
 * Food › Restaurants, Home › Rent, Insurance.
 */
async function setUp() {
	const alice = await signInUser("alice@example.com");
	const bob = await signInUser("bob@example.com");
	const carol = await signInUser("carol@example.com");
	const household = await createTestHousehold(alice.cookie);
	await addTestMember(household.id, bob.id);
	const h = householdApi(household.id);
	const chequing = await h.account(alice, { name: "Chequing" });
	const card = await h.account(bob, { name: "Bob's", visibility: "balance" });
	const food = await h.tag(alice, "Food");
	const groceries = await h.tag(alice, "Groceries", food.id);
	const restaurants = await h.tag(alice, "Restaurants", food.id);
	const home = await h.tag(alice, "Home");
	const rent = await h.tag(alice, "Rent", home.id);
	const insurance = await h.tag(alice, "Insurance");
	const base = `${h.base}/budgets`;

	const set = (user: TestUser, tagId: string, body: unknown) =>
		api(`${base}/${tagId}`, { method: "PUT", cookie: user.cookie, body });
	const stop = (user: TestUser, tagId: string, from: string) =>
		api(`${base}/${tagId}?from=${from}`, {
			method: "DELETE",
			cookie: user.cookie,
		});
	const month = async (user: TestUser, query = "") =>
		json<BudgetsMonth>(await api(`${base}${query}`, { cookie: user.cookie }));
	/** Records an expense, or a refund (an income) with `income`. */
	const spend = (
		user: TestUser,
		accountId: string,
		date: string,
		amount: number,
		tagId: string | null,
		type = "expense",
	) =>
		h.created(user, {
			type,
			accountId,
			date,
			lines: [{ amount, tagId }],
		});

	return {
		alice,
		bob,
		carol,
		household,
		h,
		base,
		chequing,
		card,
		food,
		groceries,
		restaurants,
		home,
		rent,
		insurance,
		set,
		stop,
		month,
		spend,
	};
}

describe("budgets", () => {
	it("counts what a tag and the tags under it spent in the month, refunds taken off, on every account", async () => {
		const {
			alice,
			bob,
			chequing,
			card,
			food,
			groceries,
			restaurants,
			set,
			month,
			spend,
		} = await setUp();
		await set(alice, food.id, {
			period: "month",
			amount: 50_000,
			from: "2026-11",
		});
		await spend(alice, chequing.id, "2026-11-02", 12_000, groceries.id);
		await spend(alice, chequing.id, "2026-11-08", 3_000, restaurants.id);
		await spend(
			alice,
			chequing.id,
			"2026-11-09",
			1_000,
			groceries.id,
			"income",
		);
		// On Bob's card: counted, though Alice can't see it
		await spend(bob, card.id, "2026-11-10", 2_000, restaurants.id);
		// Another month, and an uncategorized line: not counted
		await spend(alice, chequing.id, "2026-10-31", 9_900, groceries.id);
		await spend(alice, chequing.id, "2026-11-11", 5_000, null);

		expect(await month(alice)).toEqual({
			month: "2026-11",
			budgets: [
				{
					tagId: food.id,
					period: "month",
					amount: 50_000,
					since: "2026-11",
					spent: 16_000,
					upcoming: 0,
				},
			],
		});
	});

	it("applies a budget from its month on, each change from its own, the months before untouched", async () => {
		const { alice, food, set, month } = await setUp();
		await set(alice, food.id, {
			period: "month",
			amount: 50_000,
			from: "2026-11",
		});
		await set(alice, food.id, {
			period: "month",
			amount: 60_000,
			from: "2027-01",
		});
		const amountIn = async (m: string) =>
			(await month(alice, `?month=${m}`)).budgets.map((each) => [
				each.amount,
				each.since,
			]);

		expect(await amountIn("2026-10")).toEqual([]);
		expect(await amountIn("2026-12")).toEqual([[50_000, "2026-11"]]);
		expect(await amountIn("2027-03")).toEqual([[60_000, "2027-01"]]);

		// From December on: replaces the change planned for January
		await set(alice, food.id, {
			period: "month",
			amount: 55_000,
			from: "2026-12",
		});
		expect(await amountIn("2026-11")).toEqual([[50_000, "2026-11"]]);
		expect(await amountIn("2027-03")).toEqual([[55_000, "2026-12"]]);
	});

	it("stops a budget from a month on, keeping it before", async () => {
		const { alice, food, insurance, set, stop, month } = await setUp();
		await set(alice, food.id, {
			period: "month",
			amount: 50_000,
			from: "2026-09",
		});

		expect((await stop(alice, food.id, "2027-01")).status).toBe(204);
		expect((await stop(alice, insurance.id, "2027-01")).status).toBe(204);

		expect((await month(alice, "?month=2026-12")).budgets).toHaveLength(1);
		expect((await month(alice, "?month=2027-01")).budgets).toEqual([]);
		expect((await month(alice, "?month=2027-06")).budgets).toEqual([]);
	});

	it("counts a yearly budget over its year up to the end of the month, after the monthly ones", async () => {
		const { alice, chequing, food, insurance, set, month, spend } =
			await setUp();
		await set(alice, insurance.id, {
			period: "year",
			amount: 120_000,
			from: "2026-01",
		});
		await set(alice, food.id, {
			period: "month",
			amount: 50_000,
			from: "2026-01",
		});
		await spend(alice, chequing.id, "2026-03-15", 30_000, insurance.id);
		await spend(alice, chequing.id, "2026-11-01", 20_000, insurance.id);
		await spend(alice, chequing.id, "2025-12-31", 99_000, insurance.id);

		expect((await month(alice, "?month=2026-11")).budgets).toMatchObject([
			{ tagId: food.id, period: "month", spent: 0 },
			{ tagId: insurance.id, period: "year", amount: 120_000, spent: 50_000 },
		]);
		// As it stood in June: November hadn't come
		expect((await month(alice, "?month=2026-06")).budgets).toMatchObject([
			{ tagId: food.id },
			{ tagId: insurance.id, spent: 30_000, upcoming: 0 },
		]);
	});

	it("adds what the recurring expenses still plan in the period, and the days waiting", async () => {
		const { alice, h, chequing, home, rent, set, month } = await setUp();
		await set(alice, home.id, {
			period: "month",
			amount: 160_000,
			from: "2026-11",
		});
		const recurring = (startDate: string, amount: number, mode: string) =>
			api(`${h.base}/recurring-transactions`, {
				method: "POST",
				cookie: alice.cookie,
				body: {
					transaction: {
						type: "expense",
						accountId: chequing.id,
						lines: [{ amount, tagId: rent.id }],
					},
					schedule: { unit: "month", interval: 1, startDate, endDate: null },
					mode,
				},
			});
		await recurring("2026-11-20", 140_000, "automatic");
		await recurring("2026-11-15", 5_000, "confirm");
		// Today's day of the second one now waits for a member
		await runDueRecurrences();

		const upcomingIn = async (m: string) =>
			(await month(alice, `?month=${m}`)).budgets[0]?.upcoming;
		expect(await upcomingIn("2026-11")).toBe(145_000);
		expect(await upcomingIn("2026-12")).toBe(145_000);
		// Yearly: what is planned until the end of the year, from today
		await set(alice, home.id, {
			period: "year",
			amount: 2_000_000,
			from: "2026-11",
		});
		expect(await upcomingIn("2026-11")).toBe(290_000);
		// Past: nothing to come
		await set(alice, home.id, {
			period: "month",
			amount: 160_000,
			from: "2026-10",
		});
		expect(await upcomingIn("2026-10")).toBe(0);
	});

	it("suggests what the tag usually costs: the last 3 months' average, the last 12 months' sum", async () => {
		const { alice, base, chequing, food, groceries, spend } = await setUp();
		await spend(alice, chequing.id, "2026-08-10", 30_000, groceries.id);
		await spend(alice, chequing.id, "2026-09-10", 60_000, groceries.id);
		await spend(alice, chequing.id, "2026-10-10", 90_000, groceries.id);
		await spend(alice, chequing.id, "2026-07-10", 120_000, groceries.id);
		// This month isn't over: not counted
		await spend(alice, chequing.id, "2026-11-10", 999_000, groceries.id);

		const suggestion = await json<BudgetSuggestion>(
			await api(`${base}/${food.id}/suggestion`, { cookie: alice.cookie }),
		);

		expect(suggestion).toEqual({
			tagId: food.id,
			month: 60_000,
			year: 300_000,
		});
	});

	it("is set by any member, and rejects what makes no sense with a code per field", async () => {
		const { bob, food, set } = await setUp();

		expect(
			(
				await set(bob, food.id, {
					period: "month",
					amount: 1_000,
					from: "2026-11",
				})
			).status,
		).toBe(200);
		const response = await set(bob, food.id, {
			period: "week",
			amount: 0,
			from: "2026-13",
		});
		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({
			error: {
				details: expect.arrayContaining([
					{ field: "period", message: "budget_period_invalid" },
					{ field: "amount", message: "amount_not_positive" },
					{ field: "from", message: "budget_month_invalid" },
				]),
			},
		});
	});

	it("knows only the household's tags, and hides the household from outsiders", async () => {
		const { alice, carol, base, food, set } = await setUp();
		const elsewhere = await createTestHousehold(carol.cookie, "Elsewhere");
		const theirs = await householdApi(elsewhere.id).tag(carol, "Theirs");
		const body = { period: "month", amount: 1_000, from: "2026-11" };

		expect((await set(alice, theirs.id, body)).status).toBe(404);
		expect((await set(carol, food.id, body)).status).toBe(404);
		expect((await api(base, { cookie: carol.cookie })).status).toBe(404);
		expect((await api(base)).status).toBe(401);
	});

	it("goes with its tag, deleted when it had no transaction", async () => {
		const { alice, h, insurance, set, month } = await setUp();
		await set(alice, insurance.id, {
			period: "year",
			amount: 1_000,
			from: "2026-01",
		});

		const deleted = await api(`${h.base}/tags/${insurance.id}`, {
			method: "DELETE",
			cookie: alice.cookie,
		});

		expect(deleted.status).toBe(204);
		expect((await month(alice)).budgets).toEqual([]);
	});
});
