import type {
	Household,
	HouseholdInvitation,
	HouseholdMember,
	Paginated,
	ReceivedInvitation,
} from "@repo/schemas";
import { api, json } from "@test/helpers/api";
import { captureEmails } from "@test/helpers/auth";
import {
	addTestMember,
	createTestHousehold,
	signInUser,
} from "@test/helpers/households";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { householdInvitations } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { mailer } from "@/lib/mailer";

afterEach(() => {
	vi.restoreAllMocks();
});

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

function invite(
	householdId: string,
	email: string,
	cookie: string,
	headers?: Record<string, string>,
) {
	return api(`/v1/households/${householdId}/invitations`, {
		method: "POST",
		cookie,
		body: { email },
		headers,
	});
}

async function sentBy(householdId: string, cookie: string) {
	const response = await api(`/v1/households/${householdId}/invitations`, {
		cookie,
	});
	return json<Paginated<HouseholdInvitation>>(response);
}

async function receivedBy(cookie: string) {
	const response = await api("/v1/invitations", { cookie });
	return json<Paginated<ReceivedInvitation>>(response);
}

async function expire(invitationId: string) {
	await db
		.update(householdInvitations)
		.set({ expiresAt: new Date(Date.now() - 1000) })
		.where(eq(householdInvitations.id, invitationId));
}

/**
 * A household owned by Alice, with Bob as a plain member; Carol and Dave are
 * outside it. Emails sent after the sign-ins are collected in `emails`.
 */
async function setUp() {
	const alice = await signInUser("alice@example.com");
	const bob = await signInUser("bob@example.com");
	const carol = await signInUser("carol@example.com");
	const dave = await signInUser("dave@example.com");
	const household = await createTestHousehold(alice.cookie);
	await addTestMember(household.id, bob.id);
	const emails = captureEmails();
	return { alice, bob, carol, dave, household, emails };
}

/** Same, with Carol already invited by Alice. */
async function setUpInvited() {
	const context = await setUp();
	const invitation = await json<HouseholdInvitation>(
		await invite(
			context.household.id,
			"carol@example.com",
			context.alice.cookie,
		),
	);
	return { ...context, invitation };
}

describe("POST /v1/households/:householdId/invitations", () => {
	it("invites an email for 7 days and emails the invitation", async () => {
		const { alice, household, emails } = await setUp();

		const response = await invite(
			household.id,
			" Carol@Example.com ",
			alice.cookie,
		);

		expect(response.status).toBe(201);
		const invitation = await json<HouseholdInvitation>(response);
		expect(invitation).toEqual({
			id: expect.any(String),
			email: "carol@example.com",
			invitedByName: "alice@example.com",
			expiresAt: expect.any(String),
			createdAt: expect.any(String),
		});
		const days =
			(Date.parse(invitation.expiresAt) - Date.now()) / (24 * 60 * 60 * 1000);
		expect(days).toBeGreaterThan(6.9);
		expect(days).toBeLessThanOrEqual(7);
		expect(emails).toHaveLength(1);
		expect(emails[0]).toMatchObject({
			to: "carol@example.com",
			subject: "Join The Tremblays on Grand Livre",
		});
		expect(emails[0]?.text).toContain("alice@example.com invites you");
		expect(emails[0]?.text).toContain("http://localhost:3000/dashboard");
	});

	it("names the person inviting once they have a name", async () => {
		const { alice, household, emails } = await setUp();
		await api("/v1/me", {
			method: "PATCH",
			cookie: alice.cookie,
			body: { name: "Alice" },
		});

		const response = await invite(
			household.id,
			"carol@example.com",
			alice.cookie,
		);

		expect(await response.json()).toMatchObject({ invitedByName: "Alice" });
		expect(emails[0]?.text).toContain("Alice invites you");
	});

	it.each([
		["French", "fr-CA,fr;q=0.9", "Rejoignez The Tremblays sur Grand Livre"],
		["Spanish", "es-MX,es;q=0.9", "Únete a The Tremblays en Grand Livre"],
	])(
		"writes the email in %s when the person inviting uses it",
		async (_language, acceptLanguage, subject) => {
			const { alice, household, emails } = await setUp();

			await invite(household.id, "carol@example.com", alice.cookie, {
				"Accept-Language": acceptLanguage,
			});

			expect(emails[0]?.subject).toBe(subject);
		},
	);

	it("renews the invitation and emails it again when invited twice", async () => {
		const { alice, household, emails, invitation } = await setUpInvited();
		await expire(invitation.id);

		const response = await invite(
			household.id,
			"carol@example.com",
			alice.cookie,
		);

		expect(response.status).toBe(201);
		const renewed = await json<HouseholdInvitation>(response);
		expect(renewed.id).toBe(invitation.id);
		expect(Date.parse(renewed.expiresAt)).toBeGreaterThan(Date.now());
		expect(emails).toHaveLength(2);
		expect((await sentBy(household.id, alice.cookie)).pagination.total).toBe(1);
	});

	it("refuses someone who is already a member", async () => {
		const { alice, household, emails } = await setUp();

		const response = await invite(
			household.id,
			"bob@example.com",
			alice.cookie,
		);

		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({
			error: { code: "already_member" },
		});
		expect(emails).toHaveLength(0);
	});

	it("saves nothing when the email can't be sent", async () => {
		const { alice, household } = await setUp();
		vi.spyOn(mailer, "send").mockRejectedValue(
			new AppError(503, "email_unavailable", "The email could not be sent"),
		);

		const response = await invite(
			household.id,
			"carol@example.com",
			alice.cookie,
		);

		expect(response.status).toBe(503);
		expect((await sentBy(household.id, alice.cookie)).data).toEqual([]);
	});

	it("rejects an invalid email with an error code", async () => {
		const { alice, household } = await setUp();

		const response = await invite(household.id, "carol", alice.cookie);

		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({
			error: { details: [{ field: "email", message: "email_invalid" }] },
		});
	});

	it("refuses a plain member, hides the household from outsiders, requires a session", async () => {
		const { bob, carol, household, emails } = await setUp();

		const asMember = await invite(household.id, "dave@example.com", bob.cookie);
		const asOutsider = await invite(
			household.id,
			"dave@example.com",
			carol.cookie,
		);
		const signedOut = await api(`/v1/households/${household.id}/invitations`, {
			method: "POST",
			body: { email: "dave@example.com" },
		});

		expect(asMember.status).toBe(403);
		expect(asOutsider.status).toBe(404);
		expect(signedOut.status).toBe(401);
		expect(emails).toHaveLength(0);
	});
});

describe("GET /v1/households/:householdId/invitations", () => {
	it("lists the pending invitations to every member, without the expired ones", async () => {
		const { alice, bob, household, invitation } = await setUpInvited();
		const expired = await json<HouseholdInvitation>(
			await invite(household.id, "dave@example.com", alice.cookie),
		);
		await expire(expired.id);

		const invitations = await sentBy(household.id, bob.cookie);

		expect(invitations.data).toEqual([invitation]);
		expect(invitations.pagination).toEqual({ page: 1, pageSize: 20, total: 1 });
	});

	it("answers 404 to someone outside the household, even invited", async () => {
		const { carol, household } = await setUpInvited();

		const response = await api(`/v1/households/${household.id}/invitations`, {
			cookie: carol.cookie,
		});

		expect(response.status).toBe(404);
	});
});

describe("DELETE /v1/households/:householdId/invitations/:invitationId", () => {
	function cancel(householdId: string, invitationId: string, cookie: string) {
		return api(`/v1/households/${householdId}/invitations/${invitationId}`, {
			method: "DELETE",
			cookie,
		});
	}

	it("lets an owner cancel an invitation, which can no longer be accepted", async () => {
		const { alice, carol, household, invitation } = await setUpInvited();

		const response = await cancel(household.id, invitation.id, alice.cookie);

		expect(response.status).toBe(204);
		expect((await sentBy(household.id, alice.cookie)).data).toEqual([]);
		const accepted = await api(`/v1/invitations/${invitation.id}/accept`, {
			method: "POST",
			cookie: carol.cookie,
		});
		expect(accepted.status).toBe(404);
	});

	it("refuses a plain member, and answers 404 for an unknown invitation", async () => {
		const { alice, bob, household, invitation } = await setUpInvited();

		const asMember = await cancel(household.id, invitation.id, bob.cookie);
		const unknown = await cancel(household.id, UNKNOWN_ID, alice.cookie);

		expect(asMember.status).toBe(403);
		expect(unknown.status).toBe(404);
	});

	it("can't cancel the invitation of another household", async () => {
		const { carol, invitation } = await setUpInvited();
		const other = await createTestHousehold(carol.cookie, "The Gagnons");

		const response = await cancel(other.id, invitation.id, carol.cookie);

		expect(response.status).toBe(404);
	});
});

describe("GET /v1/invitations", () => {
	it("lists the invitations addressed to the signed-in user's email only", async () => {
		const { alice, carol, dave, household, invitation } = await setUpInvited();

		const forCarol = await receivedBy(carol.cookie);
		const forDave = await receivedBy(dave.cookie);
		const forAlice = await receivedBy(alice.cookie);

		expect(forCarol.data).toEqual([
			{
				id: invitation.id,
				household: { id: household.id, name: "The Tremblays" },
				invitedByName: "alice@example.com",
				expiresAt: invitation.expiresAt,
			},
		]);
		expect(forDave.data).toEqual([]);
		expect(forAlice.data).toEqual([]);
	});

	it("leaves out the expired invitations", async () => {
		const { carol, invitation } = await setUpInvited();
		await expire(invitation.id);

		expect((await receivedBy(carol.cookie)).data).toEqual([]);
	});

	it("requires a session", async () => {
		expect((await api("/v1/invitations")).status).toBe(401);
	});
});

describe("POST /v1/invitations/:invitationId/accept", () => {
	function accept(invitationId: string, cookie?: string) {
		return api(`/v1/invitations/${invitationId}/accept`, {
			method: "POST",
			cookie,
		});
	}

	it("makes the invited user a plain member and consumes the invitation", async () => {
		const { alice, carol, household, invitation } = await setUpInvited();

		const response = await accept(invitation.id, carol.cookie);

		expect(response.status).toBe(200);
		expect(await json<Household>(response)).toEqual({
			...household,
			role: "member",
		});
		const members = await json<Paginated<HouseholdMember>>(
			await api(`/v1/households/${household.id}/members`, {
				cookie: carol.cookie,
			}),
		);
		expect(members.data.at(-1)).toMatchObject({
			userId: carol.id,
			role: "member",
		});
		expect((await sentBy(household.id, alice.cookie)).data).toEqual([]);
		expect((await accept(invitation.id, carol.cookie)).status).toBe(404);
	});

	it("refuses an invitation addressed to someone else", async () => {
		const { dave, household, alice, invitation } = await setUpInvited();

		const response = await accept(invitation.id, dave.cookie);

		expect(response.status).toBe(404);
		expect((await sentBy(household.id, alice.cookie)).data).toHaveLength(1);
		const asDave = await api(`/v1/households/${household.id}`, {
			cookie: dave.cookie,
		});
		expect(asDave.status).toBe(404);
	});

	it("refuses an expired or unknown invitation, and requires a session", async () => {
		const { carol, invitation } = await setUpInvited();
		await expire(invitation.id);

		expect((await accept(invitation.id, carol.cookie)).status).toBe(404);
		expect((await accept(UNKNOWN_ID, carol.cookie)).status).toBe(404);
		expect((await accept("not-a-uuid", carol.cookie)).status).toBe(422);
		expect((await accept(invitation.id)).status).toBe(401);
	});
});

describe("POST /v1/invitations/:invitationId/decline", () => {
	function decline(invitationId: string, cookie: string) {
		return api(`/v1/invitations/${invitationId}/decline`, {
			method: "POST",
			cookie,
		});
	}

	it("removes the invitation without joining the household", async () => {
		const { alice, carol, household, invitation } = await setUpInvited();

		const response = await decline(invitation.id, carol.cookie);

		expect(response.status).toBe(204);
		expect((await receivedBy(carol.cookie)).data).toEqual([]);
		expect((await sentBy(household.id, alice.cookie)).data).toEqual([]);
		const asCarol = await api(`/v1/households/${household.id}`, {
			cookie: carol.cookie,
		});
		expect(asCarol.status).toBe(404);
	});

	it("refuses an invitation addressed to someone else", async () => {
		const { carol, dave, invitation } = await setUpInvited();

		const response = await decline(invitation.id, dave.cookie);

		expect(response.status).toBe(404);
		expect((await receivedBy(carol.cookie)).data).toHaveLength(1);
	});
});
