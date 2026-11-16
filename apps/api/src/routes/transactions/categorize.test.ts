import type {
	CategorizeResult,
	Paginated,
	Transaction,
	UncategorizedPayee,
} from "@repo/schemas";
import { api, json } from "@test/helpers/api";
import {
	addTestMember,
	createTestHousehold,
	signInUser,
	type TestUser,
} from "@test/helpers/households";
import { householdApi } from "@test/helpers/transactions";
import { describe, expect, it } from "vitest";

/**
 * Alice's account, with expenses without a tag at Costco (two spellings),
 * one at Costco already tagged, a refund from Costco, and one without a
 * payee; Bob's account, with a Costco expense of his own.
 */
async function setUp() {
	const alice = await signInUser("alice@example.com");
	const bob = await signInUser("bob@example.com");
	const carol = await signInUser("carol@example.com");
	const household = await createTestHousehold(alice.cookie);
	await addTestMember(household.id, bob.id);
	const h = householdApi(household.id);
	const chequing = await h.account(alice);
	const bobs = await h.account(bob, { name: "Bob's" });
	const fuel = await h.tag(alice, "Fuel");
	const expense = (
		user: TestUser,
		accountId: string,
		payee: string | undefined,
		amount: number,
		date: string,
		tagId?: string,
	) =>
		h.created(user, {
			type: "expense",
			accountId,
			date,
			payee,
			lines: [{ amount, tagId }],
		});
	const w100 = await expense(
		alice,
		chequing.id,
		"COSTCO ESSENCE W100",
		60_00,
		"2026-10-01",
	);
	const w1234 = await expense(
		alice,
		chequing.id,
		"COSTCO ESSENCE W1234",
		40_00,
		"2026-10-20",
	);
	const tagged = await expense(
		alice,
		chequing.id,
		"COSTCO ESSENCE W100",
		50_00,
		"2026-10-10",
		fuel.id,
	);
	const refund = await h.created(alice, {
		type: "income",
		accountId: chequing.id,
		date: "2026-10-25",
		payee: "Costco essence W100",
		lines: [{ amount: 5_00 }],
	});
	await expense(alice, chequing.id, undefined, 9_00, "2026-10-05");
	await expense(alice, chequing.id, "SAAQ", 350_86, "2026-10-05");
	const bobsCostco = await expense(
		bob,
		bobs.id,
		"COSTCO ESSENCE W100",
		70_00,
		"2026-10-12",
	);
	const list = async (user: TestUser, query = "") =>
		json<Paginated<UncategorizedPayee>>(
			await api(`${h.base}/transactions/uncategorized${query}`, {
				cookie: user.cookie,
			}),
		);
	const categorize = (user: TestUser | undefined, body: unknown) =>
		api(`${h.base}/transactions/categorize`, {
			method: "POST",
			cookie: user?.cookie,
			body,
		});
	const read = async (user: TestUser, id: string) =>
		json<Transaction>(await h.get(user, id));
	return {
		alice,
		bob,
		carol,
		h,
		fuel,
		w100,
		w1234,
		tagged,
		refund,
		bobsCostco,
		list,
		categorize,
		read,
	};
}

describe("GET /v1/households/:householdId/transactions/uncategorized", () => {
	it("groups the member's expenses and incomes without a tag by payee, the most first", async () => {
		const { alice, list } = await setUp();

		const { data, pagination } = await list(alice);

		expect(data).toEqual([
			{
				key: "costcoessencew",
				// Both spellings alike: the first in order, as often written
				payee: "COSTCO ESSENCE W1234",
				type: "expense",
				count: 2,
				total: 100_00,
				firstDate: "2026-10-01",
				lastDate: "2026-10-20",
			},
			{
				key: "saaq",
				payee: "SAAQ",
				type: "expense",
				count: 1,
				total: 350_86,
				firstDate: "2026-10-05",
				lastDate: "2026-10-05",
			},
			{
				key: "costcoessencew",
				payee: "Costco essence W100",
				type: "income",
				count: 1,
				total: 5_00,
				firstDate: "2026-10-25",
				lastDate: "2026-10-25",
			},
		]);
		expect(pagination.total).toBe(3);
		expect(
			(await list(alice, "?pageSize=1&page=2")).data.map((each) => each.key),
		).toEqual(["saaq"]);
	});

	it("shows each member only the accounts they hold", async () => {
		const { bob, list } = await setUp();

		expect((await list(bob)).data).toEqual([
			expect.objectContaining({
				key: "costcoessencew",
				count: 1,
				total: 70_00,
			}),
		]);
	});
});

describe("POST /v1/households/:householdId/transactions/categorize", () => {
	it("tags all of a payee's expenses without a tag, on the member's accounts only", async () => {
		const {
			alice,
			bob,
			fuel,
			w100,
			w1234,
			refund,
			bobsCostco,
			categorize,
			read,
			list,
		} = await setUp();

		const response = await categorize(alice, {
			key: "costcoessencew",
			type: "expense",
			tagId: fuel.id,
		});

		expect(response.status).toBe(200);
		expect(await json<CategorizeResult>(response)).toEqual({ count: 2 });
		for (const id of [w100.id, w1234.id]) {
			expect((await read(alice, id)).lines).toEqual([
				expect.objectContaining({ tagId: fuel.id }),
			]);
		}
		// The refund, an income, and Bob's expense: as they were
		expect((await read(alice, refund.id)).lines[0]?.tagId).toBeNull();
		expect((await read(bob, bobsCostco.id)).lines[0]?.tagId).toBeNull();
		expect((await list(alice)).data.map((each) => each.key)).toEqual([
			"saaq",
			"costcoessencew",
		]);
	});

	it("tags nothing when nothing is left, and refuses a tag from elsewhere", async () => {
		const { alice, fuel, categorize } = await setUp();

		expect(
			await json<CategorizeResult>(
				await categorize(alice, {
					key: "nobody",
					type: "expense",
					tagId: fuel.id,
				}),
			),
		).toEqual({ count: 0 });
		const unknown = await categorize(alice, {
			key: "saaq",
			type: "expense",
			tagId: "00000000-0000-4000-8000-000000000001",
		});
		expect(unknown.status).toBe(422);
		expect(await unknown.json()).toMatchObject({
			error: {
				details: [{ field: "tagId", message: "transaction_tag_invalid" }],
			},
		});
		expect(
			(await categorize(alice, { key: "", type: "expense", tagId: fuel.id }))
				.status,
		).toBe(422);
	});

	it("hides the household from outsiders and requires a session", async () => {
		const { carol, fuel, categorize, h } = await setUp();
		const body = { key: "saaq", type: "expense", tagId: fuel.id };

		expect((await categorize(carol, body)).status).toBe(404);
		expect((await categorize(undefined, body)).status).toBe(401);
		expect((await api(`${h.base}/transactions/uncategorized`)).status).toBe(
			401,
		);
	});
});
