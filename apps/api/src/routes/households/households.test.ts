import type { Household, HouseholdMember, Paginated } from "@repo/schemas";
import { api, json } from "@test/helpers/api";
import {
	addTestMember,
	createTestHousehold,
	signInUser,
} from "@test/helpers/households";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.restoreAllMocks();
});

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

async function membersOf(householdId: string, cookie: string) {
	const response = await api(`/v1/households/${householdId}/members`, {
		cookie,
	});
	return json<Paginated<HouseholdMember>>(response);
}

/** A household owned by Alice, with Bob as a plain member, and Carol outside it. */
async function setUp() {
	const alice = await signInUser("alice@example.com");
	const bob = await signInUser("bob@example.com");
	const carol = await signInUser("carol@example.com");
	const household = await createTestHousehold(alice.cookie);
	await addTestMember(household.id, bob.id);
	return { alice, bob, carol, household };
}

describe("POST /v1/households", () => {
	it("creates a household owned by the signed-in user", async () => {
		const alice = await signInUser("alice@example.com");

		const response = await api("/v1/households", {
			method: "POST",
			cookie: alice.cookie,
			body: { name: "  The Tremblays ", currency: "CAD" },
		});

		expect(response.status).toBe(201);
		const household = await json<Household>(response);
		expect(household).toEqual({
			id: expect.any(String),
			name: "The Tremblays",
			currency: "CAD",
			role: "owner",
			createdAt: expect.any(String),
		});
		const members = await membersOf(household.id, alice.cookie);
		expect(members.data).toMatchObject([{ userId: alice.id, role: "owner" }]);
	});

	it("rejects an invalid name or currency with error codes", async () => {
		const alice = await signInUser("alice@example.com");

		const response = await api("/v1/households", {
			method: "POST",
			cookie: alice.cookie,
			body: { name: " ", currency: "XXX" },
		});

		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({
			error: {
				details: [
					{ field: "name", message: "household_name_required" },
					{ field: "currency", message: "household_currency_invalid" },
				],
			},
		});
	});

	it("requires a session", async () => {
		const response = await api("/v1/households", {
			method: "POST",
			body: { name: "Home", currency: "CAD" },
		});

		expect(response.status).toBe(401);
	});
});

describe("GET /v1/households", () => {
	it("lists the households of the signed-in user only, with their role", async () => {
		const { alice, bob, carol, household } = await setUp();
		const other = await createTestHousehold(carol.cookie, "The Gagnons");

		const forAlice = await json<Paginated<Household>>(
			await api("/v1/households", { cookie: alice.cookie }),
		);
		const forBob = await json<Paginated<Household>>(
			await api("/v1/households", { cookie: bob.cookie }),
		);
		const forCarol = await json<Paginated<Household>>(
			await api("/v1/households", { cookie: carol.cookie }),
		);

		expect(forAlice.data).toMatchObject([{ id: household.id, role: "owner" }]);
		expect(forBob.data).toMatchObject([{ id: household.id, role: "member" }]);
		expect(forCarol.data).toMatchObject([{ id: other.id, role: "owner" }]);
		expect(forAlice.pagination).toEqual({ page: 1, pageSize: 20, total: 1 });
	});

	it("paginates, with a page size bounded by the server", async () => {
		const alice = await signInUser("alice@example.com");
		await createTestHousehold(alice.cookie, "First");
		await createTestHousehold(alice.cookie, "Second");

		const page = await json<Paginated<Household>>(
			await api("/v1/households?page=2&pageSize=1", { cookie: alice.cookie }),
		);
		const tooLarge = await api("/v1/households?pageSize=1000", {
			cookie: alice.cookie,
		});

		expect(page.data).toMatchObject([{ name: "Second" }]);
		expect(page.pagination).toEqual({ page: 2, pageSize: 1, total: 2 });
		expect(tooLarge.status).toBe(422);
	});

	it("requires a session", async () => {
		expect((await api("/v1/households")).status).toBe(401);
	});
});

describe("GET /v1/households/:householdId", () => {
	it("returns the household to its members", async () => {
		const { bob, household } = await setUp();

		const response = await api(`/v1/households/${household.id}`, {
			cookie: bob.cookie,
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ...household, role: "member" });
	});

	it("answers 404 to someone outside the household, as for an unknown one", async () => {
		const { carol, household } = await setUp();

		for (const id of [household.id, UNKNOWN_ID, "not-a-uuid"]) {
			const response = await api(`/v1/households/${id}`, {
				cookie: carol.cookie,
			});
			expect(response.status).toBe(404);
		}
	});

	it("requires a session", async () => {
		const { household } = await setUp();

		expect((await api(`/v1/households/${household.id}`)).status).toBe(401);
	});
});

describe("PATCH /v1/households/:householdId", () => {
	it("lets an owner change the name and the currency", async () => {
		const { alice, household } = await setUp();

		const response = await api(`/v1/households/${household.id}`, {
			method: "PATCH",
			cookie: alice.cookie,
			body: { name: "The Tremblay-Roys", currency: "EUR" },
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			...household,
			name: "The Tremblay-Roys",
			currency: "EUR",
		});
	});

	it("changes only the fields it receives", async () => {
		const { alice, household } = await setUp();
		const patch = (body: unknown) =>
			api(`/v1/households/${household.id}`, {
				method: "PATCH",
				cookie: alice.cookie,
				body,
			});

		expect(await (await patch({ currency: "USD" })).json()).toMatchObject({
			name: household.name,
			currency: "USD",
		});
		expect(await (await patch({})).json()).toMatchObject({
			name: household.name,
			currency: "USD",
		});
	});

	it("refuses a plain member, and hides the household from outsiders", async () => {
		const { bob, carol, household } = await setUp();
		const patch = (cookie: string) =>
			api(`/v1/households/${household.id}`, {
				method: "PATCH",
				cookie,
				body: { name: "Hijacked" },
			});

		const asMember = await patch(bob.cookie);
		const asOutsider = await patch(carol.cookie);

		expect(asMember.status).toBe(403);
		expect(await asMember.json()).toMatchObject({
			error: { code: "forbidden" },
		});
		expect(asOutsider.status).toBe(404);
	});
});

describe("GET /v1/households/:householdId/members", () => {
	it("lists the members in the order they joined, without private fields", async () => {
		const { alice, bob, household } = await setUp();

		const members = await membersOf(household.id, bob.cookie);

		expect(members.data).toEqual([
			{
				userId: alice.id,
				name: "",
				email: "alice@example.com",
				image: null,
				role: "owner",
				joinedAt: expect.any(String),
			},
			{
				userId: bob.id,
				name: "",
				email: "bob@example.com",
				image: null,
				role: "member",
				joinedAt: expect.any(String),
			},
		]);
		expect(members.pagination).toEqual({ page: 1, pageSize: 50, total: 2 });
	});

	it("answers 404 to someone outside the household", async () => {
		const { carol, household } = await setUp();

		const response = await api(`/v1/households/${household.id}/members`, {
			cookie: carol.cookie,
		});

		expect(response.status).toBe(404);
	});
});

describe("PATCH /v1/households/:householdId/members/:userId", () => {
	function setRole(
		householdId: string,
		userId: string,
		role: string,
		cookie: string,
	) {
		return api(`/v1/households/${householdId}/members/${userId}`, {
			method: "PATCH",
			cookie,
			body: { role },
		});
	}

	it("lets an owner make another member an owner, then step down", async () => {
		const { alice, bob, household } = await setUp();

		const promoted = await setRole(household.id, bob.id, "owner", alice.cookie);
		const steppedDown = await setRole(
			household.id,
			alice.id,
			"member",
			alice.cookie,
		);

		expect(promoted.status).toBe(204);
		expect(steppedDown.status).toBe(204);
		const members = await membersOf(household.id, bob.cookie);
		expect(members.data).toMatchObject([
			{ userId: alice.id, role: "member" },
			{ userId: bob.id, role: "owner" },
		]);
	});

	it("refuses to demote the last owner", async () => {
		const { alice, household } = await setUp();

		const response = await setRole(
			household.id,
			alice.id,
			"member",
			alice.cookie,
		);

		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({
			error: { code: "last_owner" },
		});
	});

	it("refuses a plain member", async () => {
		const { bob, household } = await setUp();

		const response = await setRole(household.id, bob.id, "owner", bob.cookie);

		expect(response.status).toBe(403);
	});

	it("answers 404 for someone who isn't a member, 422 for an unknown role", async () => {
		const { alice, bob, carol, household } = await setUp();

		const notMember = await setRole(
			household.id,
			carol.id,
			"owner",
			alice.cookie,
		);
		const badRole = await setRole(household.id, bob.id, "admin", alice.cookie);

		expect(notMember.status).toBe(404);
		expect(badRole.status).toBe(422);
	});
});

describe("DELETE /v1/households/:householdId/members/:userId", () => {
	function remove(householdId: string, userId: string, cookie: string) {
		return api(`/v1/households/${householdId}/members/${userId}`, {
			method: "DELETE",
			cookie,
		});
	}

	it("lets an owner remove a member, who loses access to the household", async () => {
		const { alice, bob, household } = await setUp();

		const response = await remove(household.id, bob.id, alice.cookie);

		expect(response.status).toBe(204);
		const members = await membersOf(household.id, alice.cookie);
		expect(members.data).toMatchObject([{ userId: alice.id }]);
		const asBob = await api(`/v1/households/${household.id}`, {
			cookie: bob.cookie,
		});
		expect(asBob.status).toBe(404);
	});

	it("lets a member leave", async () => {
		const { bob, household } = await setUp();

		const response = await remove(household.id, bob.id, bob.cookie);

		expect(response.status).toBe(204);
	});

	it("refuses a plain member removing someone else", async () => {
		const { alice, bob, household } = await setUp();

		const response = await remove(household.id, alice.id, bob.cookie);

		expect(response.status).toBe(403);
		const members = await membersOf(household.id, alice.cookie);
		expect(members.pagination.total).toBe(2);
	});

	it("refuses the last owner leaving, until there is another owner", async () => {
		const { alice, bob, household } = await setUp();

		const refused = await remove(household.id, alice.id, alice.cookie);
		await api(`/v1/households/${household.id}/members/${bob.id}`, {
			method: "PATCH",
			cookie: alice.cookie,
			body: { role: "owner" },
		});
		const accepted = await remove(household.id, alice.id, alice.cookie);

		expect(refused.status).toBe(409);
		expect(await refused.json()).toMatchObject({
			error: { code: "last_owner" },
		});
		expect(accepted.status).toBe(204);
	});

	it("answers 404 to an outsider and for someone who isn't a member", async () => {
		const { alice, bob, carol, household } = await setUp();

		const asOutsider = await remove(household.id, bob.id, carol.cookie);
		const notMember = await remove(household.id, carol.id, alice.cookie);

		expect(asOutsider.status).toBe(404);
		expect(notMember.status).toBe(404);
	});
});
