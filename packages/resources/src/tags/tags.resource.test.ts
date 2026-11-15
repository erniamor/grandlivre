import { describe, expect, it } from "vitest";
import { NotFoundError, ServerError, ValidationError } from "../errors";
import { fakeApi } from "../test/fake-fetch";

const HOUSEHOLD_ID = "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f";
const TAG_ID = "9c8b7a6d-5e4f-4d3c-a2b1-0f9e8d7c6b5a";
const PARENT_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

const tag = {
	id: TAG_ID,
	householdId: HOUSEHOLD_ID,
	names: { en: "Gas", fr: "Essence" },
	parentId: PARENT_ID,
	createdAt: "2026-11-14T12:00:00.000Z",
};

const base = `http://api.test/v1/households/${HOUSEHOLD_ID}/tags`;

describe("tags", () => {
	it("lists every tag of the household, without the envelope", async () => {
		const { api, requests } = fakeApi(200, {
			data: [tag],
			pagination: { page: 1, pageSize: 500, total: 1 },
		});

		expect(await api.tags.list(HOUSEHOLD_ID)).toEqual([tag]);
		expect(requests[0]).toMatchObject({
			url: `${base}?pageSize=500`,
			method: "GET",
		});
	});

	it("throws a NotFoundError for a household the user isn't a member of", async () => {
		const { api } = fakeApi(404, {
			error: { code: "not_found", message: "Household not found" },
		});

		await expect(api.tags.list(HOUSEHOLD_ID)).rejects.toBeInstanceOf(
			NotFoundError,
		);
	});

	it("rejects a response that doesn't match the contract", async () => {
		const { api } = fakeApi(200, {
			data: [{ ...tag, parentId: "car" }],
			pagination: { page: 1, pageSize: 500, total: 1 },
		});

		await expect(api.tags.list(HOUSEHOLD_ID)).rejects.toBeInstanceOf(
			ServerError,
		);
	});

	it("creates a tag", async () => {
		const { api, requests } = fakeApi(201, tag);

		expect(
			await api.tags.create(HOUSEHOLD_ID, {
				names: { en: " Gas ", fr: "Essence" },
				parentId: PARENT_ID,
			}),
		).toEqual(tag);
		expect(requests[0]).toMatchObject({
			url: base,
			method: "POST",
			body: { names: { en: "Gas", fr: "Essence" }, parentId: PARENT_ID },
		});
	});

	it("rejects a tag without a name before sending", async () => {
		const { api, fetch } = fakeApi(201, tag);

		const error = await api.tags
			.create(HOUSEHOLD_ID, { names: { fr: " " } })
			.catch((reason: unknown) => reason);

		expect(error).toBeInstanceOf(ValidationError);
		expect((error as ValidationError).issues).toEqual([
			{ field: "names.fr", message: "tag_name_required" },
		]);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("reports a name already taken next to its language", async () => {
		const { api } = fakeApi(422, {
			error: {
				code: "validation_error",
				message: "Invalid request",
				details: [{ field: "names.fr", message: "tag_name_taken" }],
			},
		});

		const error = await api.tags
			.create(HOUSEHOLD_ID, { names: { fr: "Essence" } })
			.catch((reason: unknown) => reason);

		expect((error as ValidationError).issues).toEqual([
			{ field: "names.fr", message: "tag_name_taken" },
		]);
	});

	it("adds the suggested tags", async () => {
		const { api, requests } = fakeApi(204);

		await api.tags.addSuggested(HOUSEHOLD_ID);

		expect(requests[0]).toMatchObject({
			url: `${base}/suggested`,
			method: "POST",
		});
	});

	it("updates the fields given", async () => {
		const { api, requests } = fakeApi(200, { ...tag, parentId: null });

		expect(
			await api.tags.update(HOUSEHOLD_ID, TAG_ID, { parentId: null }),
		).toMatchObject({ parentId: null });
		expect(requests[0]).toMatchObject({
			url: `${base}/${TAG_ID}`,
			method: "PATCH",
			body: { parentId: null },
		});
	});

	it("removes a tag", async () => {
		const { api, requests } = fakeApi(204);

		await api.tags.remove(HOUSEHOLD_ID, TAG_ID);

		expect(requests[0]).toMatchObject({
			url: `${base}/${TAG_ID}`,
			method: "DELETE",
		});
	});

	it("reports a tag that has child tags with its error code", async () => {
		const { api } = fakeApi(409, {
			error: { code: "tag_has_children", message: "Has child tags" },
		});

		await expect(api.tags.remove(HOUSEHOLD_ID, TAG_ID)).rejects.toMatchObject({
			status: 409,
			code: "tag_has_children",
		});
	});
});
