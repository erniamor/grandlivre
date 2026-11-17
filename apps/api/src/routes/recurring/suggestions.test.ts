import type { Paginated, RecurringSuggestion } from "@repo/schemas";
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

/** The 1st of the 6 months before December 2026, as a mortgage is paid. */
const MONTHS = ["06", "07", "08", "09", "10", "11"];

/**
 * A household owned by Alice, with Bob. Alice holds chequing, where she
 * pays her mortgage on the 1st and is paid on the 15th; Bob holds his own
 * account, where he pays his phone on the 8th.
 */
async function setUp() {
	const alice = await signInUser("alice@example.com");
	const bob = await signInUser("bob@example.com");
	const carol = await signInUser("carol@example.com");
	const household = await createTestHousehold(alice.cookie);
	await addTestMember(household.id, bob.id);
	const h = householdApi(household.id);
	const chequing = await h.account(alice, { name: "Chequing" });
	const bobs = await h.account(bob, { name: "Bob's" });
	const home = await h.tag(alice, "Home");
	for (const month of MONTHS) {
		await h.created(alice, {
			type: "expense",
			accountId: chequing.id,
			date: `2026-${month}-01`,
			payee: "HYPOTHEQUE EXEMPLE",
			lines: [{ amount: 1_450_00, tagId: home.id }],
		});
		await h.created(alice, {
			type: "income",
			accountId: chequing.id,
			date: `2026-${month}-15`,
			payee: "ATELIER BOREAL INC.",
			lines: [{ amount: 2_875_40 }],
		});
		await h.created(bob, {
			type: "expense",
			accountId: bobs.id,
			date: `2026-${month}-08`,
			payee: "TELECOM EXEMPLE",
			lines: [{ amount: 41_00 }],
		});
	}
	const base = `${h.base}/recurring-transactions`;
	const suggestions = async (user: TestUser) =>
		json<Paginated<RecurringSuggestion>>(
			await api(`${base}/suggestions`, { cookie: user.cookie }),
		);
	const dismiss = (user: TestUser | null, body: unknown) =>
		api(`${base}/suggestions/dismiss`, {
			method: "POST",
			cookie: user?.cookie,
			body,
		});
	return {
		alice,
		bob,
		carol,
		household,
		h,
		chequing,
		bobs,
		home,
		base,
		suggestions,
		dismiss,
	};
}

/** What tells a suggestion apart, as a dismissal names it. */
const keyOf = (suggestion: RecurringSuggestion) => ({
	accountId: suggestion.accountId,
	toAccountId: suggestion.toAccountId,
	type: suggestion.type,
	key: suggestion.key,
	unit: suggestion.unit,
	interval: suggestion.interval,
	startDate: suggestion.nextDate,
});

describe("GET /v1/households/:householdId/recurring-transactions/suggestions", () => {
	it("offers the series of the accounts the member holds, the next due first", async () => {
		const { alice, bob, chequing, bobs, home, suggestions } = await setUp();

		const alices = await suggestions(alice);

		expect(alices).toEqual({
			data: [
				{
					accountId: chequing.id,
					toAccountId: null,
					type: "expense",
					key: "hypothequeexemple",
					payee: "HYPOTHEQUE EXEMPLE",
					unit: "month",
					interval: 1,
					amount: 1_450_00,
					minAmount: 1_450_00,
					maxAmount: 1_450_00,
					mode: "automatic",
					nextDate: "2026-12-01",
					tagId: home.id,
					count: 6,
					dates: MONTHS.map((month) => `2026-${month}-01`),
				},
				expect.objectContaining({
					type: "income",
					key: "atelierborealinc",
					nextDate: "2026-12-15",
					tagId: null,
				}),
			],
			pagination: { page: 1, pageSize: 50, total: 2 },
		});
		// Bob's phone is his alone to make recurring
		expect((await suggestions(bob)).data).toEqual([
			expect.objectContaining({ accountId: bobs.id, key: "telecomexemple" }),
		]);
	});

	it("no longer offers a series a recurring transaction covers, even renamed", async () => {
		const { alice, chequing, base, suggestions } = await setUp();
		await api(base, {
			method: "POST",
			cookie: alice.cookie,
			body: {
				transaction: {
					type: "income",
					accountId: chequing.id,
					payee: "Boréal",
					lines: [{ amount: 2_875_40, tagId: null }],
				},
				schedule: {
					unit: "month",
					interval: 1,
					startDate: "2026-12-15",
					endDate: null,
				},
				mode: "automatic",
			},
		});

		const { data } = await suggestions(alice);

		expect(data.map(({ key }) => key)).toEqual(["hypothequeexemple"]);
	});

	it("answers 404 outside the household, 401 when signed out", async () => {
		const { carol, base } = await setUp();

		expect(
			(await api(`${base}/suggestions`, { cookie: carol.cookie })).status,
		).toBe(404);
		expect((await api(`${base}/suggestions`)).status).toBe(401);
	});
});

describe("POST /v1/households/:householdId/recurring-transactions/suggestions/dismiss", () => {
	it("no longer offers a series dismissed, to any member", async () => {
		const { alice, suggestions, dismiss } = await setUp();
		const [mortgage] = (await suggestions(alice)).data;

		const response = await dismiss(
			alice,
			keyOf(mortgage as RecurringSuggestion),
		);

		expect(response.status).toBe(204);
		expect((await suggestions(alice)).data.map(({ key }) => key)).toEqual([
			"atelierborealinc",
		]);
	});

	it("lets only a holder of its account dismiss a series", async () => {
		const { alice, bob, carol, suggestions, dismiss } = await setUp();
		const [phone] = (await suggestions(bob)).data;
		const key = keyOf(phone as RecurringSuggestion);

		expect((await dismiss(alice, key)).status).toBe(404);
		expect((await dismiss(carol, key)).status).toBe(404);
		expect((await dismiss(null, key)).status).toBe(401);
		expect((await suggestions(bob)).data).toHaveLength(1);
	});

	it("refuses a transfer without its destination", async () => {
		const { alice, chequing, dismiss } = await setUp();

		const response = await dismiss(alice, {
			accountId: chequing.id,
			toAccountId: null,
			type: "transfer",
			key: "",
			unit: "month",
			interval: 1,
			startDate: "2026-12-01",
		});

		expect(response.status).toBe(422);
	});
});
