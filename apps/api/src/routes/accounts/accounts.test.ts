import type { Account, AccountsSummary, Paginated } from "@repo/schemas";
import { api, json } from "@test/helpers/api";
import {
	addTestMember,
	createTestHousehold,
	signInUser,
	type TestUser,
} from "@test/helpers/households";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.restoreAllMocks();
});

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

const chequing = {
	name: "Chequing",
	type: "checking",
	visibility: "details",
	openingBalance: 125_050,
};

/**
 * A household owned by Alice, with Bob and Carol as plain members; Dave is
 * outside it.
 */
async function setUp() {
	const alice = await signInUser("alice@example.com");
	const bob = await signInUser("bob@example.com");
	const carol = await signInUser("carol@example.com");
	const dave = await signInUser("dave@example.com");
	const household = await createTestHousehold(alice.cookie);
	await addTestMember(household.id, bob.id);
	await addTestMember(household.id, carol.id);
	const base = `/v1/households/${household.id}/accounts`;

	const create = (user: TestUser, body: unknown = chequing) =>
		api(base, { method: "POST", cookie: user.cookie, body });
	const created = async (user: TestUser, body: unknown = chequing) =>
		json<Account>(await create(user, body));
	const get = (user: TestUser, accountId: string) =>
		api(`${base}/${accountId}`, { cookie: user.cookie });
	const update = (user: TestUser, accountId: string, body: unknown) =>
		api(`${base}/${accountId}`, { method: "PATCH", cookie: user.cookie, body });
	const remove = (user: TestUser, accountId: string) =>
		api(`${base}/${accountId}`, { method: "DELETE", cookie: user.cookie });
	const list = async (user: TestUser, query = "") =>
		json<Paginated<Account>>(
			await api(`${base}${query}`, { cookie: user.cookie }),
		);
	const leave = (user: TestUser) =>
		api(`/v1/households/${household.id}/members/${user.id}`, {
			method: "DELETE",
			cookie: user.cookie,
		});

	return {
		alice,
		bob,
		carol,
		dave,
		household,
		base,
		create,
		created,
		get,
		update,
		remove,
		list,
		leave,
	};
}

describe("POST /v1/households/:householdId/accounts", () => {
	it("creates an account held by the member who creates it", async () => {
		const { bob, household, create } = await setUp();

		const response = await create(bob, { ...chequing, name: "  Chequing " });

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({
			id: expect.any(String),
			householdId: household.id,
			name: "Chequing",
			type: "checking",
			visibility: "details",
			balance: 125_050,
			openingBalance: 125_050,
			holders: [{ userId: bob.id, name: "bob@example.com" }],
			isHolder: true,
			archived: false,
			createdAt: expect.any(String),
		});
	});

	it("creates a shared account, and names the holders once they have a name", async () => {
		const { alice, bob, created } = await setUp();
		await api("/v1/me", {
			method: "PATCH",
			cookie: bob.cookie,
			body: { name: "Bob" },
		});

		const account = await created(alice, {
			...chequing,
			name: "Joint",
			holderIds: [alice.id, bob.id],
		});

		expect(account.holders).toEqual([
			{ userId: alice.id, name: "alice@example.com" },
			{ userId: bob.id, name: "Bob" },
		]);
	});

	it("keeps a negative opening balance for money owed", async () => {
		const { alice, created } = await setUp();

		const account = await created(alice, {
			name: "Visa",
			type: "credit_card",
			visibility: "balance",
			openingBalance: -45_000,
		});

		expect(account).toMatchObject({
			balance: -45_000,
			openingBalance: -45_000,
		});
	});

	it("refuses holders without the creator, or from outside the household", async () => {
		const { alice, bob, dave, create } = await setUp();

		for (const holderIds of [
			[bob.id],
			[alice.id, dave.id],
			[alice.id, UNKNOWN_ID],
		]) {
			const response = await create(alice, { ...chequing, holderIds });

			expect(response.status).toBe(422);
			expect(await response.json()).toMatchObject({
				error: {
					code: "validation_error",
					details: [{ field: "holderIds", message: "account_holders_invalid" }],
				},
			});
		}
	});

	it("rejects invalid fields with error codes", async () => {
		const { alice, create } = await setUp();

		const response = await create(alice, {
			name: " ",
			type: "crypto",
			visibility: "hidden",
			openingBalance: 12.5,
		});

		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({
			error: {
				details: [
					{ field: "name", message: "account_name_required" },
					{ field: "type", message: "account_type_invalid" },
					{ field: "visibility", message: "account_visibility_invalid" },
					{ field: "openingBalance", message: "amount_invalid" },
				],
			},
		});
	});

	it("hides the household from outsiders and requires a session", async () => {
		const { dave, base, create } = await setUp();

		const asOutsider = await create(dave);
		const signedOut = await api(base, { method: "POST", body: chequing });

		expect(asOutsider.status).toBe(404);
		expect(signedOut.status).toBe(401);
	});
});

describe("GET /v1/households/:householdId/accounts", () => {
	it("lists every account of the household to its members, oldest first", async () => {
		const { alice, bob, carol, created, list } = await setUp();
		const first = await created(alice);
		const second = await created(bob, { ...chequing, name: "Savings" });

		const accounts = await list(carol);

		expect(accounts.data.map((account) => account.id)).toEqual([
			first.id,
			second.id,
		]);
		expect(accounts.data.every((account) => !account.isHolder)).toBe(true);
		expect(accounts.pagination).toEqual({ page: 1, pageSize: 50, total: 2 });
	});

	it("tells each member which accounts they hold", async () => {
		const { alice, bob, created, list } = await setUp();
		await created(alice);

		expect((await list(alice)).data).toMatchObject([{ isHolder: true }]);
		expect((await list(bob)).data).toMatchObject([{ isHolder: false }]);
	});

	it("shows only the balance of a balance-only account to those who don't hold it", async () => {
		const { alice, bob, created, list } = await setUp();
		await created(alice, { ...chequing, visibility: "balance" });

		const [forHolder] = (await list(alice)).data;
		const [forOther] = (await list(bob)).data;

		expect(forHolder).toMatchObject({
			balance: 125_050,
			openingBalance: 125_050,
		});
		expect(forOther).toMatchObject({
			name: "Chequing",
			balance: 125_050,
			openingBalance: null,
		});
	});

	it("paginates, with a page size bounded by the server", async () => {
		const { alice, base, created, list } = await setUp();
		await created(alice);
		await created(alice, { ...chequing, name: "Savings" });

		const page = await list(alice, "?page=2&pageSize=1");
		const tooLarge = await api(`${base}?pageSize=1000`, {
			cookie: alice.cookie,
		});

		expect(page.data).toMatchObject([{ name: "Savings" }]);
		expect(page.pagination).toEqual({ page: 2, pageSize: 1, total: 2 });
		expect(tooLarge.status).toBe(422);
	});

	it("hides the household from outsiders and requires a session", async () => {
		const { dave, base } = await setUp();

		expect((await api(base, { cookie: dave.cookie })).status).toBe(404);
		expect((await api(base)).status).toBe(401);
	});
});

describe("GET /v1/households/:householdId/accounts/:accountId", () => {
	it("returns the account to any member of the household", async () => {
		const { alice, bob, created, get } = await setUp();
		const account = await created(alice);

		const response = await get(bob, account.id);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ...account, isHolder: false });
	});

	it("answers 404 for an unknown account, or one of another household", async () => {
		const { alice, dave, created, get } = await setUp();
		const account = await created(alice);
		const other = await createTestHousehold(dave.cookie, "The Gagnons");

		const unknown = await get(alice, UNKNOWN_ID);
		const elsewhere = await api(
			`/v1/households/${other.id}/accounts/${account.id}`,
			{ cookie: dave.cookie },
		);
		const asOutsider = await get(dave, account.id);

		expect(unknown.status).toBe(404);
		expect(elsewhere.status).toBe(404);
		expect(asOutsider.status).toBe(404);
	});
});

describe("PATCH /v1/households/:householdId/accounts/:accountId", () => {
	it("lets a holder change the fields sent, and only those", async () => {
		const { alice, created, update } = await setUp();
		const account = await created(alice);

		const response = await update(alice, account.id, {
			name: "Everyday",
			visibility: "balance",
			openingBalance: 200,
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			...account,
			name: "Everyday",
			visibility: "balance",
			openingBalance: 200,
			balance: 200,
		});
		expect(await (await update(alice, account.id, {})).json()).toMatchObject({
			name: "Everyday",
			type: "checking",
		});
	});

	it("lets a holder share the account, then leave it to the other holder", async () => {
		const { alice, bob, created, update, get } = await setUp();
		const account = await created(alice);

		const shared = await json<Account>(
			await update(alice, account.id, { holderIds: [alice.id, bob.id] }),
		);
		const handedOver = await json<Account>(
			await update(alice, account.id, { holderIds: [bob.id] }),
		);

		expect(shared.holders.map((holder) => holder.userId)).toEqual([
			alice.id,
			bob.id,
		]);
		expect(handedOver).toMatchObject({
			holders: [{ userId: bob.id }],
			isHolder: false,
		});
		expect(await (await get(bob, account.id)).json()).toMatchObject({
			isHolder: true,
		});
	});

	it("refuses a member who doesn't hold the account, even an owner of the household", async () => {
		const { alice, bob, created, update, get } = await setUp();
		const account = await created(bob);

		for (const user of [alice]) {
			const response = await update(user, account.id, { name: "Hijacked" });

			expect(response.status).toBe(403);
			expect(await response.json()).toMatchObject({
				error: { code: "forbidden" },
			});
		}
		expect(await (await get(bob, account.id)).json()).toMatchObject({
			name: "Chequing",
		});
	});

	it("refuses holders from outside the household, or no holder at all", async () => {
		const { alice, dave, created, update } = await setUp();
		const account = await created(alice);

		const outsider = await update(alice, account.id, {
			holderIds: [alice.id, dave.id],
		});
		const nobody = await update(alice, account.id, { holderIds: [] });

		expect(outsider.status).toBe(422);
		expect(await outsider.json()).toMatchObject({
			error: {
				details: [{ field: "holderIds", message: "account_holders_invalid" }],
			},
		});
		expect(nobody.status).toBe(422);
		expect(await nobody.json()).toMatchObject({
			error: {
				details: [{ field: "holderIds", message: "account_holders_required" }],
			},
		});
	});

	it("answers 404 for an unknown account and to outsiders", async () => {
		const { alice, dave, created, update } = await setUp();
		const account = await created(alice);

		expect((await update(alice, UNKNOWN_ID, { name: "X" })).status).toBe(404);
		expect((await update(dave, account.id, { name: "X" })).status).toBe(404);
	});
});

describe("an account whose last holder left the household", () => {
	it("stays in the household without a holder, and still counts", async () => {
		const { alice, bob, base, created, leave, get } = await setUp();
		const account = await created(bob);

		expect((await leave(bob)).status).toBe(204);

		expect(await (await get(alice, account.id)).json()).toMatchObject({
			name: "Chequing",
			holders: [],
			balance: 125_050,
		});
		const summary = await json<AccountsSummary>(
			await api(`${base}/summary`, { cookie: alice.cookie }),
		);
		expect(summary.balance).toBe(125_050);
	});

	it("can be given a holder, or deleted, by an owner of the household only", async () => {
		const { alice, bob, carol, created, leave, update, remove } = await setUp();
		const first = await created(bob);
		const second = await created(bob, { ...chequing, name: "Savings" });
		await leave(bob);

		const asMember = await update(carol, first.id, { holderIds: [carol.id] });
		const asOwner = await update(alice, first.id, { holderIds: [carol.id] });
		const deletedByMember = await remove(carol, second.id);
		const deletedByOwner = await remove(alice, second.id);

		expect(asMember.status).toBe(403);
		expect(asOwner.status).toBe(200);
		expect(await asOwner.json()).toMatchObject({
			holders: [{ userId: carol.id }],
		});
		expect(deletedByMember.status).toBe(403);
		expect(deletedByOwner.status).toBe(204);
	});

	it("keeps a shared account with its remaining holder", async () => {
		const { alice, bob, created, leave, get } = await setUp();
		const account = await created(alice, {
			...chequing,
			holderIds: [alice.id, bob.id],
		});

		await leave(bob);

		expect(await (await get(alice, account.id)).json()).toMatchObject({
			holders: [{ userId: alice.id }],
			isHolder: true,
		});
	});
});

describe("DELETE /v1/households/:householdId/accounts/:accountId", () => {
	it("lets a holder delete the account", async () => {
		const { alice, created, remove, get, list } = await setUp();
		const account = await created(alice);

		const response = await remove(alice, account.id);

		expect(response.status).toBe(204);
		expect((await get(alice, account.id)).status).toBe(404);
		expect((await list(alice)).data).toEqual([]);
	});

	it("refuses a member who doesn't hold the account, and answers 404 to outsiders", async () => {
		const { alice, bob, dave, created, remove, list } = await setUp();
		const account = await created(bob);

		const asOwnerOfHousehold = await remove(alice, account.id);
		const asOutsider = await remove(dave, account.id);
		const unknown = await remove(bob, UNKNOWN_ID);

		expect(asOwnerOfHousehold.status).toBe(403);
		expect(asOutsider.status).toBe(404);
		expect(unknown.status).toBe(404);
		expect((await list(bob)).pagination.total).toBe(1);
	});
});

describe("GET /v1/households/:householdId/accounts/summary", () => {
	it("is zero for a household without accounts", async () => {
		const { alice, base } = await setUp();

		const response = await api(`${base}/summary`, { cookie: alice.cookie });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			assets: 0,
			liabilities: 0,
			balance: 0,
		});
	});

	it("adds up every account of the household, whoever holds it and whatever its visibility", async () => {
		const { alice, bob, carol, base, created } = await setUp();
		await created(alice);
		await created(bob, {
			name: "Savings",
			type: "savings",
			visibility: "balance",
			openingBalance: 1_000_000,
		});
		await created(bob, {
			name: "Visa",
			type: "credit_card",
			visibility: "balance",
			openingBalance: -45_000,
		});
		await created(alice, {
			name: "Mortgage",
			type: "loan",
			visibility: "details",
			openingBalance: -25_000_000,
		});

		const summary = await json<AccountsSummary>(
			await api(`${base}/summary`, { cookie: carol.cookie }),
		);

		expect(summary).toEqual({
			assets: 1_125_050,
			liabilities: -25_045_000,
			balance: -23_919_950,
		});
	});

	it("leaves out the accounts of other households", async () => {
		const { alice, dave, base, created } = await setUp();
		await created(alice);
		const other = await createTestHousehold(dave.cookie, "The Gagnons");
		await api(`/v1/households/${other.id}/accounts`, {
			method: "POST",
			cookie: dave.cookie,
			body: { ...chequing, openingBalance: 999 },
		});

		const summary = await json<AccountsSummary>(
			await api(`${base}/summary`, { cookie: alice.cookie }),
		);

		expect(summary.balance).toBe(125_050);
	});

	it("hides the household from outsiders and requires a session", async () => {
		const { dave, base } = await setUp();

		expect((await api(`${base}/summary`, { cookie: dave.cookie })).status).toBe(
			404,
		);
		expect((await api(`${base}/summary`)).status).toBe(401);
	});
});

describe("the household's currency", () => {
	function setCurrency(householdId: string, currency: string, cookie: string) {
		return api(`/v1/households/${householdId}`, {
			method: "PATCH",
			cookie,
			body: { currency },
		});
	}

	it("can't change once the household has an account", async () => {
		const { alice, household, created } = await setUp();
		await created(alice);

		const response = await setCurrency(household.id, "EUR", alice.cookie);

		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({
			error: { code: "currency_locked" },
		});
	});

	it("can still be sent unchanged, with another field", async () => {
		const { alice, household, created } = await setUp();
		await created(alice);

		const response = await api(`/v1/households/${household.id}`, {
			method: "PATCH",
			cookie: alice.cookie,
			body: { name: "The Tremblay-Roys", currency: "CAD" },
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ name: "The Tremblay-Roys" });
	});

	it("can change again once the accounts are deleted", async () => {
		const { alice, household, created, remove } = await setUp();
		const account = await created(alice);
		await remove(alice, account.id);

		const response = await setCurrency(household.id, "EUR", alice.cookie);

		expect(response.status).toBe(200);
	});
});
