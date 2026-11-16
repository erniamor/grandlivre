import { describe, expect, it } from "vitest";
import {
	ApiError,
	ForbiddenError,
	NotFoundError,
	ServerError,
	ValidationError,
} from "../errors";
import { fakeApi } from "../test/fake-fetch";

const HOUSEHOLD_ID = "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f";
const USER_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const INVITATION_ID = "9c8b7a6d-5e4f-4d3c-a2b1-0f9e8d7c6b5a";
const NOW = "2026-11-14T12:00:00.000Z";

const household = {
	id: HOUSEHOLD_ID,
	name: "The Tremblays",
	currency: "CAD",
	timeZone: "America/Toronto",
	expenseSharing: false,
	role: "owner",
	createdAt: NOW,
};

const member = {
	userId: USER_ID,
	name: "Alice",
	email: "alice@example.com",
	image: null,
	role: "owner",
	joinedAt: NOW,
};

const invitation = {
	id: INVITATION_ID,
	email: "carol@example.com",
	invitedByName: "Alice",
	expiresAt: NOW,
	createdAt: NOW,
};

const page = <T>(item: T) => ({
	data: [item],
	pagination: { page: 2, pageSize: 10, total: 11 },
});

const notFound = {
	error: { code: "not_found", message: "Household not found" },
};

describe("households", () => {
	it("lists the user's households as a page, without the envelope", async () => {
		const { api, requests } = fakeApi(200, page(household));

		expect(await api.households.list({ page: 2, pageSize: 10 })).toEqual({
			items: [household],
			page: 2,
			pageSize: 10,
			total: 11,
		});
		expect(requests[0]).toMatchObject({
			url: "http://api.test/v1/households?page=2&pageSize=10",
			method: "GET",
		});
	});

	it("lists without query parameters by default", async () => {
		const { api, requests } = fakeApi(200, page(household));

		await api.households.list();

		expect(requests[0]?.url).toBe("http://api.test/v1/households");
	});

	it("gets a household", async () => {
		const { api, requests } = fakeApi(200, household);

		expect(await api.households.get(HOUSEHOLD_ID)).toEqual(household);
		expect(requests[0]?.url).toBe(
			`http://api.test/v1/households/${HOUSEHOLD_ID}`,
		);
	});

	it("throws a NotFoundError for a household the user isn't a member of", async () => {
		const { api } = fakeApi(404, notFound);

		await expect(api.households.get(HOUSEHOLD_ID)).rejects.toBeInstanceOf(
			NotFoundError,
		);
	});

	it("keeps an identifier from changing the requested path", async () => {
		const { api, requests } = fakeApi(404, notFound);

		await api.households.get("../me").catch(() => undefined);

		expect(requests[0]?.url).toBe("http://api.test/v1/households/..%2Fme");
	});

	it("rejects a response that doesn't match the contract", async () => {
		const { api } = fakeApi(200, { ...household, currency: "XXX" });

		await expect(api.households.get(HOUSEHOLD_ID)).rejects.toBeInstanceOf(
			ServerError,
		);
	});

	it("creates a household", async () => {
		const { api, requests } = fakeApi(201, household);

		expect(
			await api.households.create({ name: " The Tremblays ", currency: "CAD" }),
		).toEqual(household);
		expect(requests[0]).toMatchObject({
			url: "http://api.test/v1/households",
			method: "POST",
			body: { name: "The Tremblays", currency: "CAD" },
		});
	});

	it("sends the time zone it lives in, and checks it before sending", async () => {
		const { api, requests, fetch } = fakeApi(201, household);

		await api.households.create({
			name: "The Tremblays",
			currency: "CAD",
			timeZone: "America/Vancouver",
		});
		const error = await api.households
			.create({ name: "Home", currency: "CAD", timeZone: "Nowhere/Land" })
			.catch((reason: unknown) => reason);

		expect(requests[0]?.body).toMatchObject({ timeZone: "America/Vancouver" });
		expect((error as ValidationError).issues).toEqual([
			{ field: "timeZone", message: "household_time_zone_invalid" },
		]);
		expect(fetch).toHaveBeenCalledOnce();
	});

	it("rejects an invalid household before sending", async () => {
		const { api, fetch } = fakeApi(201, household);

		const error = await api.households
			.create({ name: " ", currency: "CAD" })
			.catch((reason: unknown) => reason);

		expect(error).toBeInstanceOf(ValidationError);
		expect((error as ValidationError).issues).toEqual([
			{ field: "name", message: "household_name_required" },
		]);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("updates the fields given", async () => {
		const { api, requests } = fakeApi(200, { ...household, currency: "EUR" });

		expect(
			await api.households.update(HOUSEHOLD_ID, { currency: "EUR" }),
		).toMatchObject({ currency: "EUR" });
		expect(requests[0]).toMatchObject({
			url: `http://api.test/v1/households/${HOUSEHOLD_ID}`,
			method: "PATCH",
			body: { currency: "EUR" },
		});
	});

	it("throws a ForbiddenError when the user isn't an owner", async () => {
		const { api } = fakeApi(403, {
			error: { code: "forbidden", message: "Owners only" },
		});

		await expect(
			api.households.update(HOUSEHOLD_ID, { name: "Home" }),
		).rejects.toBeInstanceOf(ForbiddenError);
	});
});

describe("households.members", () => {
	it("lists the members as a page", async () => {
		const { api, requests } = fakeApi(200, page(member));

		expect(
			await api.households.members.list(HOUSEHOLD_ID, { page: 2 }),
		).toMatchObject({ items: [member], total: 11 });
		expect(requests[0]?.url).toBe(
			`http://api.test/v1/households/${HOUSEHOLD_ID}/members?page=2`,
		);
	});

	it("changes a member's role", async () => {
		const { api, requests } = fakeApi(204);

		await api.households.members.update(HOUSEHOLD_ID, USER_ID, {
			role: "member",
		});

		expect(requests[0]).toMatchObject({
			url: `http://api.test/v1/households/${HOUSEHOLD_ID}/members/${USER_ID}`,
			method: "PATCH",
			body: { role: "member" },
		});
	});

	it("removes a member", async () => {
		const { api, requests } = fakeApi(204);

		await api.households.members.remove(HOUSEHOLD_ID, USER_ID);

		expect(requests[0]).toMatchObject({
			url: `http://api.test/v1/households/${HOUSEHOLD_ID}/members/${USER_ID}`,
			method: "DELETE",
		});
	});

	it("reports the last owner with its error code", async () => {
		const { api } = fakeApi(409, {
			error: { code: "last_owner", message: "At least one owner" },
		});

		const error = await api.households.members
			.remove(HOUSEHOLD_ID, USER_ID)
			.catch((reason: unknown) => reason);

		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({ status: 409, code: "last_owner" });
	});
});

describe("households.invitations", () => {
	it("lists the pending invitations as a page", async () => {
		const { api, requests } = fakeApi(200, page(invitation));

		expect(await api.households.invitations.list(HOUSEHOLD_ID)).toMatchObject({
			items: [invitation],
		});
		expect(requests[0]?.url).toBe(
			`http://api.test/v1/households/${HOUSEHOLD_ID}/invitations`,
		);
	});

	it("invites an email, normalized, in the user's language", async () => {
		const { api, requests } = fakeApi(201, invitation);

		expect(
			await api.households.invitations.create(HOUSEHOLD_ID, {
				email: " Carol@Example.com ",
			}),
		).toEqual(invitation);
		expect(requests[0]).toMatchObject({
			url: `http://api.test/v1/households/${HOUSEHOLD_ID}/invitations`,
			method: "POST",
			body: { email: "carol@example.com" },
			headers: { "accept-language": "fr" },
		});
	});

	it("rejects an invalid email before sending", async () => {
		const { api, fetch } = fakeApi(201, invitation);

		await expect(
			api.households.invitations.create(HOUSEHOLD_ID, { email: "carol" }),
		).rejects.toBeInstanceOf(ValidationError);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("reports an email that already belongs to a member", async () => {
		const { api } = fakeApi(409, {
			error: { code: "already_member", message: "Already a member" },
		});

		await expect(
			api.households.invitations.create(HOUSEHOLD_ID, {
				email: "bob@example.com",
			}),
		).rejects.toMatchObject({ status: 409, code: "already_member" });
	});

	it("cancels an invitation", async () => {
		const { api, requests } = fakeApi(204);

		await api.households.invitations.remove(HOUSEHOLD_ID, INVITATION_ID);

		expect(requests[0]).toMatchObject({
			url: `http://api.test/v1/households/${HOUSEHOLD_ID}/invitations/${INVITATION_ID}`,
			method: "DELETE",
		});
	});
});
