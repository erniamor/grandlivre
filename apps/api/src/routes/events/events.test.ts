import type { HouseholdInvitation } from "@repo/schemas";
import { api, json } from "@test/helpers/api";
import { captureEmails } from "@test/helpers/auth";
import { openEvents } from "@test/helpers/events";
import {
	addTestMember,
	createTestHousehold,
	signInUser,
} from "@test/helpers/households";
import { householdApi } from "@test/helpers/transactions";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.restoreAllMocks();
});

/** A household owned by Alice, with Bob as a plain member; Carol is outside it. */
async function setUp() {
	const alice = await signInUser("alice@example.com");
	const bob = await signInUser("bob@example.com");
	const carol = await signInUser("carol@example.com");
	const household = await createTestHousehold(alice.cookie);
	await addTestMember(household.id, bob.id);
	captureEmails();
	return { alice, bob, carol, household, h: householdApi(household.id) };
}

describe("GET /v1/households/:householdId/events", () => {
	it("opens a stream of server-sent events for a member", async () => {
		const { bob, household } = await setUp();

		const stream = await openEvents(household.id, bob.cookie);

		expect(stream.response.status).toBe(200);
		expect(stream.response.headers.get("content-type")).toContain(
			"text/event-stream",
		);
		expect(stream.response.headers.get("cache-control")).toContain("no-cache");
		expect(stream.response.headers.get("x-accel-buffering")).toBe("no");
		expect(stream.events).toEqual([]);
		await stream.close();
	});

	it("tells a member what another member changed, without any data", async () => {
		const { alice, bob, household, h } = await setUp();
		const stream = await openEvents(household.id, bob.cookie);

		await h.tag(alice, "Car");

		await vi.waitFor(() => expect(stream.events).toEqual([{ topic: "tags" }]));
		await stream.close();
	});

	it("tells the one who made the change too", async () => {
		const { alice, household, h } = await setUp();
		const stream = await openEvents(household.id, alice.cookie);

		await h.account(alice);

		await vi.waitFor(() => expect(stream.topics()).toEqual(["accounts"]));
		await stream.close();
	});

	it("names what each kind of change touches", async () => {
		const { alice, bob, carol, household, h } = await setUp();
		const stream = await openEvents(household.id, bob.cookie);
		/** Runs a change, and returns the topics it published. */
		const topicsOf = async (change: () => unknown) => {
			const before = stream.events.length;
			await change();
			await vi.waitFor(() =>
				expect(stream.events.length).toBeGreaterThan(before),
			);
			// Leaves the time for a second event of the same change to arrive
			await new Promise((resolve) => setTimeout(resolve, 100));
			return stream.topics().slice(before);
		};
		const base = `/v1/households/${household.id}`;
		const call = (method: string, path: string, body?: unknown, user = alice) =>
			api(`${base}${path}`, { method, cookie: user.cookie, body });

		// The household itself
		expect(await topicsOf(() => call("PATCH", "", { name: "Home" }))).toEqual([
			"household",
		]);

		// Accounts
		let account = { id: "" };
		expect(
			await topicsOf(async () => {
				account = await h.account(alice);
			}),
		).toEqual(["accounts"]);
		expect(
			await topicsOf(() =>
				h.updateAccount(alice, account.id, { name: "Main" }),
			),
		).toEqual(["accounts"]);

		// Tags
		let tag = { id: "" };
		expect(
			await topicsOf(async () => {
				tag = await h.tag(alice, "Car");
			}),
		).toEqual(["tags"]);
		expect(
			await topicsOf(() =>
				call("PATCH", `/tags/${tag.id}`, { parentId: null }),
			),
		).toEqual(["tags"]);
		expect(
			await topicsOf(() => call("POST", "/tags/suggested", { keys: ["home"] })),
		).toEqual(["tags"]);

		// Transactions
		const expense = {
			type: "expense",
			accountId: account.id,
			date: "2026-11-14",
			lines: [{ amount: 100, tagId: tag.id }],
		};
		let transactionId = "";
		expect(
			await topicsOf(async () => {
				transactionId = (await h.created(alice, expense)).id;
			}),
		).toEqual(["transactions"]);
		expect(
			await topicsOf(() => h.replace(alice, transactionId, expense)),
		).toEqual(["transactions"]);
		expect(await topicsOf(() => h.remove(alice, transactionId))).toEqual([
			"transactions",
		]);
		// Recurring transactions, on a day that is never past
		const recurring = {
			transaction: { ...expense, date: undefined },
			schedule: {
				unit: "month",
				interval: 1,
				startDate: "2999-01-01",
				endDate: null,
			},
		};
		let recurringId = "";
		expect(
			await topicsOf(async () => {
				const response = await call(
					"POST",
					"/recurring-transactions",
					recurring,
				);
				recurringId = ((await response.json()) as { id: string }).id;
			}),
		).toEqual(["recurring"]);
		expect(
			await topicsOf(() =>
				call("PUT", `/recurring-transactions/${recurringId}`, recurring),
			),
		).toEqual(["recurring"]);
		expect(
			await topicsOf(() =>
				call("DELETE", `/recurring-transactions/${recurringId}`),
			),
		).toEqual(["recurring"]);
		// Budgets
		expect(
			await topicsOf(() =>
				call("PUT", `/budgets/${tag.id}`, {
					period: "month",
					amount: 1_000,
					from: "2999-01",
				}),
			),
		).toEqual(["budgets"]);
		expect(
			await topicsOf(() => call("DELETE", `/budgets/${tag.id}?from=2999-02`)),
		).toEqual(["budgets"]);
		expect(await topicsOf(() => call("DELETE", `/tags/${tag.id}`))).toEqual([
			"tags",
		]);
		expect(
			await topicsOf(() => call("DELETE", `/accounts/${account.id}`)),
		).toEqual(["accounts"]);

		// Invitations and members
		let invitationId = "";
		expect(
			await topicsOf(async () => {
				const response = await call("POST", "/invitations", {
					email: "carol@example.com",
				});
				invitationId = (await json<HouseholdInvitation>(response)).id;
			}),
		).toEqual(["invitations"]);
		expect(
			await topicsOf(() =>
				api(`/v1/invitations/${invitationId}/accept`, {
					method: "POST",
					cookie: carol.cookie,
				}),
			),
		).toEqual(["members", "invitations"]);
		expect(
			await topicsOf(() =>
				call("PATCH", `/members/${carol.id}`, { role: "owner" }),
			),
		).toEqual(["members"]);
		// Leaving also frees the accounts the member held
		expect(
			await topicsOf(() => call("DELETE", `/members/${carol.id}`)),
		).toEqual(["members", "accounts"]);

		await stream.close();
	});

	it("says nothing when a change is refused", async () => {
		const { alice, bob, household, h } = await setUp();
		const stream = await openEvents(household.id, alice.cookie);

		// Bob isn't an owner; the name is blank
		await api(`/v1/households/${household.id}`, {
			method: "PATCH",
			cookie: bob.cookie,
			body: { name: "Hijacked" },
		});
		await h.updateAccount(alice, "00000000-0000-4000-8000-000000000000", {
			name: " ",
		});
		// A change that is accepted, to know the refused ones had their time
		await h.tag(alice, "Car");

		await vi.waitFor(() => expect(stream.topics()).toEqual(["tags"]));
		await stream.close();
	});

	it("keeps the events of a household from the members of another", async () => {
		const { alice, carol, household, h } = await setUp();
		const other = await createTestHousehold(carol.cookie, "The Gagnons");
		const elsewhere = await openEvents(other.id, carol.cookie);
		const here = await openEvents(household.id, alice.cookie);

		await h.tag(alice, "Car");

		await vi.waitFor(() => expect(here.topics()).toEqual(["tags"]));
		expect(elsewhere.events).toEqual([]);
		await here.close();
		await elsewhere.close();
	});

	it("closes the stream of a member who leaves the household, or is removed from it", async () => {
		const { alice, bob, household } = await setUp();
		const bobs = await openEvents(household.id, bob.cookie);
		const alices = await openEvents(household.id, alice.cookie);

		await api(`/v1/households/${household.id}/members/${bob.id}`, {
			method: "DELETE",
			cookie: alice.cookie,
		});

		await vi.waitFor(() => expect(bobs.ended()).toBe(true));
		// Bob isn't told who is left; Alice's stream goes on
		expect(bobs.events).toEqual([]);
		await vi.waitFor(() =>
			expect(alices.topics()).toEqual(["members", "accounts"]),
		);
		expect(alices.ended()).toBe(false);
		await alices.close();
	});

	it("hides the household from outsiders and requires a session", async () => {
		const { carol, household } = await setUp();

		const asOutsider = await openEvents(household.id, carol.cookie);
		const signedOut = await openEvents(household.id);

		expect(asOutsider.response.status).toBe(404);
		expect(signedOut.response.status).toBe(401);
	});
});
