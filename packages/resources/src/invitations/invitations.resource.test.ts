import { describe, expect, it } from "vitest";
import { NotFoundError, UnauthorizedError } from "../errors";
import { fakeApi } from "../test/fake-fetch";

const HOUSEHOLD_ID = "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f";
const INVITATION_ID = "9c8b7a6d-5e4f-4d3c-a2b1-0f9e8d7c6b5a";
const NOW = "2026-11-14T12:00:00.000Z";

const received = {
	id: INVITATION_ID,
	household: { id: HOUSEHOLD_ID, name: "The Tremblays" },
	invitedByName: "Alice",
	expiresAt: NOW,
};

const household = {
	id: HOUSEHOLD_ID,
	name: "The Tremblays",
	currency: "CAD",
	role: "member",
	createdAt: NOW,
};

describe("invitations", () => {
	it("lists the invitations received as a page, without the envelope", async () => {
		const { api, requests } = fakeApi(200, {
			data: [received],
			pagination: { page: 1, pageSize: 20, total: 1 },
		});

		expect(await api.invitations.list()).toEqual({
			items: [received],
			page: 1,
			pageSize: 20,
			total: 1,
		});
		expect(requests[0]).toMatchObject({
			url: "http://api.test/v1/invitations",
			method: "GET",
		});
	});

	it("throws an UnauthorizedError without a session", async () => {
		const { api } = fakeApi(401, {
			error: { code: "unauthorized", message: "Sign-in required" },
		});

		await expect(api.invitations.list()).rejects.toBeInstanceOf(
			UnauthorizedError,
		);
	});

	it("accepts an invitation and returns the household joined", async () => {
		const { api, requests } = fakeApi(200, household);

		expect(await api.invitations.accept(INVITATION_ID)).toEqual(household);
		expect(requests[0]).toMatchObject({
			url: `http://api.test/v1/invitations/${INVITATION_ID}/accept`,
			method: "POST",
		});
	});

	it("throws a NotFoundError for an expired or cancelled invitation", async () => {
		const { api } = fakeApi(404, {
			error: { code: "not_found", message: "Invitation not found" },
		});

		await expect(api.invitations.accept(INVITATION_ID)).rejects.toBeInstanceOf(
			NotFoundError,
		);
	});

	it("declines an invitation", async () => {
		const { api, requests } = fakeApi(204);

		await api.invitations.decline(INVITATION_ID);

		expect(requests[0]).toMatchObject({
			url: `http://api.test/v1/invitations/${INVITATION_ID}/decline`,
			method: "POST",
		});
	});
});
