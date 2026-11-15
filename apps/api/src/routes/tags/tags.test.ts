import type { Paginated, Tag } from "@repo/schemas";
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

/** A household owned by Alice, with Bob as a plain member; Carol is outside it. */
async function setUp() {
	const alice = await signInUser("alice@example.com");
	const bob = await signInUser("bob@example.com");
	const carol = await signInUser("carol@example.com");
	const household = await createTestHousehold(alice.cookie);
	await addTestMember(household.id, bob.id);
	const base = `/v1/households/${household.id}/tags`;

	const create = (user: TestUser, body: unknown) =>
		api(base, { method: "POST", cookie: user.cookie, body });
	const created = async (user: TestUser, body: unknown) =>
		json<Tag>(await create(user, body));
	const update = (user: TestUser, tagId: string, body: unknown) =>
		api(`${base}/${tagId}`, { method: "PATCH", cookie: user.cookie, body });
	const remove = (user: TestUser, tagId: string) =>
		api(`${base}/${tagId}`, { method: "DELETE", cookie: user.cookie });
	const list = async (user: TestUser) =>
		json<Paginated<Tag>>(await api(base, { cookie: user.cookie }));
	const addSuggested = (user: TestUser) =>
		api(`${base}/suggested`, { method: "POST", cookie: user.cookie });

	return {
		alice,
		bob,
		carol,
		household,
		base,
		create,
		created,
		update,
		remove,
		list,
		addSuggested,
	};
}

const nameTaken = (locale: string) => ({
	error: {
		code: "validation_error",
		details: [{ field: `names.${locale}`, message: "tag_name_taken" }],
	},
});

describe("POST /v1/households/:householdId/tags", () => {
	it("lets any member create a tag at the root, named in their language", async () => {
		const { bob, household, create } = await setUp();

		const response = await create(bob, { names: { fr: "  Voiture " } });

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({
			id: expect.any(String),
			householdId: household.id,
			names: { fr: "Voiture" },
			parentId: null,
			createdAt: expect.any(String),
		});
	});

	it("creates a tag under a parent, with a name per language", async () => {
		const { alice, created } = await setUp();
		const car = await created(alice, { names: { en: "Car" } });

		const gas = await created(alice, {
			names: { en: "Gas", fr: "Essence", es: "Gasolina" },
			parentId: car.id,
		});

		expect(gas).toMatchObject({
			names: { en: "Gas", fr: "Essence", es: "Gasolina" },
			parentId: car.id,
		});
	});

	it("refuses a name another tag has in the same language, whatever its case", async () => {
		const { alice, bob, created, create } = await setUp();
		await created(alice, { names: { en: "Gas", fr: "Essence" } });

		const response = await create(bob, {
			names: { en: "Fuel", fr: "ESSENCE" },
		});

		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject(nameTaken("fr"));
	});

	it("accepts the same name in another language, or in another household", async () => {
		const { alice, carol, created, create } = await setUp();
		await created(alice, { names: { fr: "Restaurant" } });
		const other = await createTestHousehold(carol.cookie, "The Gagnons");

		const otherLanguage = await create(alice, { names: { en: "Restaurant" } });
		const otherHousehold = await api(`/v1/households/${other.id}/tags`, {
			method: "POST",
			cookie: carol.cookie,
			body: { names: { fr: "Restaurant" } },
		});

		expect(otherLanguage.status).toBe(201);
		expect(otherHousehold.status).toBe(201);
	});

	it("refuses a parent that doesn't exist in the household", async () => {
		const { alice, carol, create } = await setUp();
		const other = await createTestHousehold(carol.cookie, "The Gagnons");
		const elsewhere = await json<Tag>(
			await api(`/v1/households/${other.id}/tags`, {
				method: "POST",
				cookie: carol.cookie,
				body: { names: { en: "Car" } },
			}),
		);

		for (const parentId of [UNKNOWN_ID, elsewhere.id]) {
			const response = await create(alice, { names: { en: "Gas" }, parentId });

			expect(response.status).toBe(422);
			expect(await response.json()).toMatchObject({
				error: {
					details: [{ field: "parentId", message: "tag_parent_invalid" }],
				},
			});
		}
	});

	it("rejects a tag without a name, with an error code", async () => {
		const { alice, create } = await setUp();

		const response = await create(alice, { names: { fr: " " } });

		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({
			error: {
				details: [{ field: "names.fr", message: "tag_name_required" }],
			},
		});
	});

	it("hides the household from outsiders and requires a session", async () => {
		const { carol, base, create } = await setUp();

		expect((await create(carol, { names: { en: "Car" } })).status).toBe(404);
		expect(
			(await api(base, { method: "POST", body: { names: { en: "Car" } } }))
				.status,
		).toBe(401);
	});
});

describe("GET /v1/households/:householdId/tags", () => {
	it("lists the household's tags to its members, oldest first, with their parent", async () => {
		const { alice, bob, created, list } = await setUp();
		const car = await created(alice, { names: { en: "Car", fr: "Voiture" } });
		const gas = await created(bob, {
			names: { fr: "Essence" },
			parentId: car.id,
		});

		const tags = await list(bob);

		expect(tags.data).toEqual([car, gas]);
		expect(tags.pagination).toEqual({ page: 1, pageSize: 500, total: 2 });
	});

	it("leaves out the tags of other households", async () => {
		const { alice, carol, created, list } = await setUp();
		await created(alice, { names: { en: "Car" } });
		const other = await createTestHousehold(carol.cookie, "The Gagnons");

		const tags = await json<Paginated<Tag>>(
			await api(`/v1/households/${other.id}/tags`, { cookie: carol.cookie }),
		);

		expect(tags.data).toEqual([]);
		expect((await list(alice)).pagination.total).toBe(1);
	});

	it("hides the household from outsiders and requires a session", async () => {
		const { carol, base } = await setUp();

		expect((await api(base, { cookie: carol.cookie })).status).toBe(404);
		expect((await api(base)).status).toBe(401);
	});
});

describe("PATCH /v1/households/:householdId/tags/:tagId", () => {
	it("lets any member translate a tag: the names sent replace all of them", async () => {
		const { alice, bob, created, update } = await setUp();
		const tag = await created(alice, { names: { fr: "Essence" } });

		const response = await update(bob, tag.id, {
			names: { en: "Gas", fr: "Essence" },
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			...tag,
			names: { en: "Gas", fr: "Essence" },
		});
		expect(
			await (await update(bob, tag.id, { names: { en: "Fuel" } })).json(),
		).toMatchObject({ names: { en: "Fuel" } });
	});

	it("lets a tag keep its own name, and refuses another tag's", async () => {
		const { alice, created, update } = await setUp();
		const gas = await created(alice, { names: { en: "Gas" } });
		await created(alice, { names: { en: "Car" } });

		const same = await update(alice, gas.id, { names: { en: "gas" } });
		const taken = await update(alice, gas.id, { names: { en: "car" } });

		expect(same.status).toBe(200);
		expect(taken.status).toBe(422);
		expect(await taken.json()).toMatchObject(nameTaken("en"));
	});

	it("moves a tag under another one, or back to the root, without touching its names", async () => {
		const { alice, created, update } = await setUp();
		const home = await created(alice, { names: { en: "Home" } });
		const internet = await created(alice, { names: { en: "Internet" } });

		const moved = await json<Tag>(
			await update(alice, internet.id, { parentId: home.id }),
		);
		const back = await json<Tag>(
			await update(alice, internet.id, { parentId: null }),
		);

		expect(moved).toEqual({ ...internet, parentId: home.id });
		expect(back).toEqual(internet);
	});

	it("refuses to move a tag under itself or one of its descendants", async () => {
		const { alice, created, update, list } = await setUp();
		const home = await created(alice, { names: { en: "Home" } });
		const bills = await created(alice, {
			names: { en: "Bills" },
			parentId: home.id,
		});
		const internet = await created(alice, {
			names: { en: "Internet" },
			parentId: bills.id,
		});

		for (const parentId of [home.id, bills.id, internet.id, UNKNOWN_ID]) {
			const response = await update(alice, home.id, { parentId });

			expect(response.status).toBe(422);
			expect(await response.json()).toMatchObject({
				error: {
					details: [{ field: "parentId", message: "tag_parent_invalid" }],
				},
			});
		}
		expect((await list(alice)).data[0]).toMatchObject({ parentId: null });
	});

	it("changes nothing without fields, and answers 404 for an unknown tag", async () => {
		const { alice, carol, created, update } = await setUp();
		const tag = await created(alice, { names: { en: "Car" } });

		expect(await (await update(alice, tag.id, {})).json()).toEqual(tag);
		expect((await update(alice, UNKNOWN_ID, {})).status).toBe(404);
		expect((await update(carol, tag.id, {})).status).toBe(404);
	});
});

describe("DELETE /v1/households/:householdId/tags/:tagId", () => {
	it("lets any member delete a tag without child tags", async () => {
		const { alice, bob, created, remove, list } = await setUp();
		const tag = await created(alice, { names: { en: "Car" } });

		const response = await remove(bob, tag.id);

		expect(response.status).toBe(204);
		expect((await list(alice)).data).toEqual([]);
	});

	it("refuses a tag that has child tags, until they are gone", async () => {
		const { alice, created, remove } = await setUp();
		const car = await created(alice, { names: { en: "Car" } });
		const gas = await created(alice, {
			names: { en: "Gas" },
			parentId: car.id,
		});

		const refused = await remove(alice, car.id);
		await remove(alice, gas.id);
		const accepted = await remove(alice, car.id);

		expect(refused.status).toBe(409);
		expect(await refused.json()).toMatchObject({
			error: { code: "tag_has_children" },
		});
		expect(accepted.status).toBe(204);
	});

	it("frees the names of the deleted tag", async () => {
		const { alice, created, create, remove } = await setUp();
		const tag = await created(alice, { names: { en: "Car" } });
		await remove(alice, tag.id);

		expect((await create(alice, { names: { en: "Car" } })).status).toBe(201);
	});

	it("answers 404 for an unknown tag and to outsiders", async () => {
		const { alice, carol, created, remove } = await setUp();
		const tag = await created(alice, { names: { en: "Car" } });

		expect((await remove(alice, UNKNOWN_ID)).status).toBe(404);
		expect((await remove(carol, tag.id)).status).toBe(404);
	});
});

describe("POST /v1/households/:householdId/tags/suggested", () => {
	it("adds a tree of tags named in every language", async () => {
		const { bob, addSuggested, list } = await setUp();

		const response = await addSuggested(bob);

		expect(response.status).toBe(204);
		const tags = (await list(bob)).data;
		const home = tags.find((tag) => tag.names.en === "Home");
		const mortgage = tags.find((tag) => tag.names.en === "Mortgage");
		expect(home).toMatchObject({
			names: { en: "Home", fr: "Maison", es: "Hogar" },
			parentId: null,
		});
		expect(mortgage).toMatchObject({
			names: { en: "Mortgage", fr: "Hypothèque", es: "Hipoteca" },
			parentId: home?.id,
		});
		expect(tags.length).toBeGreaterThan(10);
	});

	it("adds nothing twice", async () => {
		const { alice, addSuggested, list } = await setUp();
		await addSuggested(alice);
		const { total } = (await list(alice)).pagination;

		expect((await addSuggested(alice)).status).toBe(204);
		expect((await list(alice)).pagination.total).toBe(total);
	});

	it("keeps the household's own tags, and puts the suggested children under them", async () => {
		const { alice, created, addSuggested, list } = await setUp();
		const mine = await created(alice, { names: { fr: "voiture" } });

		await addSuggested(alice);

		const tags = (await list(alice)).data;
		expect(tags.filter((tag) => tag.names.en === "Car")).toEqual([]);
		expect(tags.find((tag) => tag.id === mine.id)).toEqual(mine);
		expect(tags.find((tag) => tag.names.en === "Gas")).toMatchObject({
			parentId: mine.id,
		});
	});

	it("hides the household from outsiders and requires a session", async () => {
		const { carol, base, addSuggested } = await setUp();

		expect((await addSuggested(carol)).status).toBe(404);
		expect((await api(`${base}/suggested`, { method: "POST" })).status).toBe(
			401,
		);
	});
});
