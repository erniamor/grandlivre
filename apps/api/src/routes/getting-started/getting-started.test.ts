import type { GettingStarted } from "@repo/schemas";
import { api, json } from "@test/helpers/api";
import {
	addTestMember,
	createTestHousehold,
	signInUser,
	type TestUser,
} from "@test/helpers/households";
import { householdApi } from "@test/helpers/transactions";
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { statementImports } from "@/db/schema";

async function setUp() {
	const alice = await signInUser("alice@example.com");
	const bob = await signInUser("bob@example.com");
	const carol = await signInUser("carol@example.com");
	const household = await createTestHousehold(alice.cookie);
	const h = householdApi(household.id);
	const path = `${h.base}/getting-started`;
	const read = async (user: TestUser) =>
		json<GettingStarted>(await api(path, { cookie: user.cookie }));
	return { alice, bob, carol, household, h, path, read };
}

describe("GET /v1/households/:householdId/getting-started", () => {
	it("starts with every step to do", async () => {
		const { alice, read } = await setUp();

		expect(await read(alice)).toEqual({
			hidden: false,
			steps: {
				tags: false,
				accounts: false,
				wallet: false,
				members: false,
				imported: false,
				categorized: true,
				recurring: false,
				budgets: false,
			},
			uncategorized: 0,
		});
	});

	it("follows the household's data: tags, accounts, a wallet, members, an import, what is left to tag", async () => {
		const { alice, bob, household, h, read } = await setUp();
		const tag = await h.tag(alice, "Groceries");
		const chequing = await h.account(alice);
		await h.account(alice, { name: "Wallet", type: "cash", openingBalance: 0 });
		await addTestMember(household.id, bob.id);
		await db.insert(statementImports).values({
			householdId: household.id,
			format: "desjardins_accounts",
			createdBy: alice.id,
		});
		await h.created(alice, {
			type: "expense",
			accountId: chequing.id,
			date: "2026-11-01",
			lines: [{ amount: 10_00 }],
		});
		await h.created(alice, {
			type: "expense",
			accountId: chequing.id,
			date: "2026-11-02",
			lines: [{ amount: 20_00, tagId: tag.id }],
		});
		// A transfer has nothing to tag
		await h.created(alice, {
			type: "transfer",
			accountId: chequing.id,
			toAccountId: (
				await h.account(alice, { name: "Savings", type: "savings" })
			).id,
			date: "2026-11-03",
			amount: 5_00,
		});
		await api(`${h.base}/budgets/${tag.id}`, {
			method: "PUT",
			cookie: alice.cookie,
			body: { period: "month", amount: 100_00, from: "2026-11" },
		});

		const alices = await read(alice);
		const bobs = await read(bob);

		expect(alices).toMatchObject({
			steps: {
				tags: true,
				accounts: true,
				wallet: true,
				members: true,
				imported: true,
				categorized: false,
				recurring: false,
				budgets: true,
			},
			uncategorized: 1,
		});
		// Bob holds no account: no wallet, nothing of his to tag
		expect(bobs).toMatchObject({
			steps: { wallet: false, categorized: true },
			uncategorized: 0,
		});
	});

	it("counts an invitation sent as members", async () => {
		const { alice, h, read } = await setUp();

		await api(`${h.base}/invitations`, {
			method: "POST",
			cookie: alice.cookie,
			body: { email: "dave@example.com" },
		});

		expect((await read(alice)).steps.members).toBe(true);
	});

	it("is hidden by a member for themselves only, and shown again", async () => {
		const { alice, bob, household, path, read } = await setUp();
		await addTestMember(household.id, bob.id);

		const hidden = await api(path, {
			method: "PUT",
			cookie: alice.cookie,
			body: { hidden: true },
		});

		expect(hidden.status).toBe(200);
		expect(await json<GettingStarted>(hidden)).toMatchObject({ hidden: true });
		expect((await read(bob)).hidden).toBe(false);
		await api(path, {
			method: "PUT",
			cookie: alice.cookie,
			body: { hidden: false },
		});
		expect((await read(alice)).hidden).toBe(false);
		expect(
			(
				await api(path, {
					method: "PUT",
					cookie: alice.cookie,
					body: { hidden: "yes" },
				})
			).status,
		).toBe(422);
	});

	it("hides the household from outsiders and requires a session", async () => {
		const { carol, path } = await setUp();

		expect((await api(path, { cookie: carol.cookie })).status).toBe(404);
		expect((await api(path)).status).toBe(401);
	});
});
