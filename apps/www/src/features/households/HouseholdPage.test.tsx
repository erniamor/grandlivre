import type { Household } from "@repo/schemas";
import { toast } from "@repo/ui";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HouseholdPage } from "@/features/households/HouseholdPage";
import { setTestLocale } from "@/test/locale";
import {
	type ApiRequest,
	type ApiResponse,
	aliceProfile,
	mockApi,
} from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

afterEach(() => {
	vi.restoreAllMocks();
});

const NOW = "2026-11-14T12:00:00.000Z";
const BOB_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const INVITATION_ID = "9c8b7a6d-5e4f-4d3c-a2b1-0f9e8d7c6b5a";

const household: Household = {
	id: "7d6c5b4a-3f2e-4d1c-8b0a-9f8e7d6c5b4a",
	name: "The Tremblays",
	currency: "CAD",
	timeZone: "America/Toronto",
	expenseSharing: false,
	role: "owner",
	createdAt: NOW,
};

const alice = {
	userId: aliceProfile.id,
	name: "Alice",
	email: "alice@example.com",
	image: null,
	role: "owner",
	joinedAt: NOW,
};

const bob = {
	userId: BOB_ID,
	name: "Bob",
	email: "bob@example.com",
	image: null,
	role: "member",
	joinedAt: NOW,
};

const invitation = {
	id: INVITATION_ID,
	email: "carol@example.com",
	invitedByName: "Alice",
	expiresAt: NOW,
	createdAt: NOW,
};

const base = `/households/${household.id}`;

function page(items: unknown[]): ApiResponse {
	return {
		status: 200,
		body: {
			data: items,
			pagination: { page: 1, pageSize: 100, total: items.length },
		},
	};
}

interface Setup {
	role?: Household["role"];
	invitations?: unknown[];
	respond?: (request: ApiRequest) => ApiResponse | undefined;
}

/**
 * Renders the page for Alice, in a household with Bob. Reads are answered
 * with the members and `invitations`, writes with `respond`.
 */
function setUp({ role = "owner", invitations = [], respond }: Setup = {}) {
	const requests = mockApi((request) => {
		if (request.method === "GET" && request.path === `${base}/members`) {
			return page([{ ...alice, role }, bob]);
		}
		if (request.method === "GET" && request.path === `${base}/invitations`) {
			return page(invitations);
		}
		return respond?.(request);
	});
	const onMembershipChanged = vi.fn();
	renderWithRouter(
		<HouseholdPage
			me={aliceProfile}
			household={{ ...household, role }}
			onMembershipChanged={onMembershipChanged}
		/>,
	);
	return {
		user: userEvent.setup(),
		onMembershipChanged,
		/** The requests that change something, without the reads. */
		writes: () => requests.filter((request) => request.method !== "GET"),
	};
}

const members = () => screen.findByRole("region", { name: "Members" });

async function memberRow(name: string) {
	const row = within(await members())
		.getByText(name)
		.closest("li");
	if (!row) {
		throw new Error(`No row for ${name}`);
	}
	return within(row);
}

describe("HouseholdPage", () => {
	it.each([
		["en", "Household", "Members", "Member"],
		["fr", "Foyer", "Membres", "Membre"],
		["es", "Hogar", "Miembros", "Miembro"],
	] as const)(
		"shows the household and its members, in %s",
		async (locale, title, membersTitle, roleLabel) => {
			setTestLocale(locale);
			setUp({ role: "member" });

			expect(
				await screen.findByRole("heading", { level: 1, name: title }),
			).toBeVisible();
			expect(screen.getByText("The Tremblays")).toBeVisible();
			const list = within(screen.getByRole("region", { name: membersTitle }));
			expect(list.getByText("Bob")).toBeVisible();
			expect(list.getByText("bob@example.com")).toBeVisible();
			// Alice and Bob are both plain members here
			expect(list.getAllByText(roleLabel)).toHaveLength(2);
		},
	);

	describe("for an owner", () => {
		it("renames the household", async () => {
			const { user, writes } = setUp({
				respond: () => ({
					status: 200,
					body: { ...household, name: "The Tremblay-Roys" },
				}),
			});

			await user.click(
				await screen.findByRole("button", { name: "Rename the household" }),
			);
			const field = screen.getByLabelText("Household name");
			await user.clear(field);
			await user.type(field, " The Tremblay-Roys {Enter}");

			await vi.waitFor(() =>
				expect(writes()).toEqual([
					{ method: "PATCH", path: base, body: { name: "The Tremblay-Roys" } },
				]),
			);
		});

		it("refuses a blank name without calling the API", async () => {
			const { user, writes } = setUp();

			await user.click(
				await screen.findByRole("button", { name: "Rename the household" }),
			);
			await user.clear(screen.getByLabelText("Household name"));
			await user.click(screen.getByRole("button", { name: "Save" }));

			expect(
				await screen.findByText("Enter a name for the household."),
			).toBeVisible();
			expect(writes()).toEqual([]);
		});

		it("changes the currency", async () => {
			const { user, writes } = setUp({
				respond: () => ({
					status: 200,
					body: { ...household, currency: "EUR" },
				}),
			});

			await user.selectOptions(await screen.findByLabelText("Currency"), "EUR");

			await vi.waitFor(() =>
				expect(writes()).toEqual([
					{ method: "PATCH", path: base, body: { currency: "EUR" } },
				]),
			);
		});

		it("changes the time zone the household lives in", async () => {
			const { user, writes } = setUp({
				respond: () => ({
					status: 200,
					body: { ...household, timeZone: "America/Vancouver" },
				}),
			});

			const field = await screen.findByLabelText("Time zone");
			expect(field).toHaveValue("America/Toronto");
			await user.selectOptions(field, "America/Vancouver");

			await vi.waitFor(() =>
				expect(writes()).toEqual([
					{
						method: "PATCH",
						path: base,
						body: { timeZone: "America/Vancouver" },
					},
				]),
			);
		});

		it("turns on settling shared expenses between members", async () => {
			const { user, writes } = setUp({
				respond: () => ({
					status: 200,
					body: { ...household, expenseSharing: true },
				}),
			});

			const toggle = await screen.findByRole("checkbox", {
				name: "Settle shared expenses between members",
			});
			expect(toggle).not.toBeChecked();
			await user.click(toggle);

			await vi.waitFor(() =>
				expect(writes()).toEqual([
					{ method: "PATCH", path: base, body: { expenseSharing: true } },
				]),
			);
		});

		it("makes another member an owner", async () => {
			const { user, writes, onMembershipChanged } = setUp({
				respond: () => ({ status: 204 }),
			});

			await user.selectOptions(
				await screen.findByLabelText("Role of Bob"),
				"Owner",
			);

			await vi.waitFor(() =>
				expect(writes()).toEqual([
					{
						method: "PATCH",
						path: `${base}/members/${BOB_ID}`,
						body: { role: "owner" },
					},
				]),
			);
			expect(onMembershipChanged).not.toHaveBeenCalled();
		});

		it("reports their own change of role", async () => {
			const { user, onMembershipChanged } = setUp({
				respond: () => ({ status: 204 }),
			});

			await user.selectOptions(
				await screen.findByLabelText("Role of Alice"),
				"Member",
			);

			await vi.waitFor(() =>
				expect(onMembershipChanged).toHaveBeenCalledWith(false),
			);
		});

		it("says why the last owner can't step down", async () => {
			const error = vi.spyOn(toast, "error").mockImplementation(() => "");
			const { user, onMembershipChanged } = setUp({
				respond: () => ({
					status: 409,
					body: { error: { code: "last_owner", message: "One owner" } },
				}),
			});

			await user.selectOptions(
				await screen.findByLabelText("Role of Alice"),
				"Member",
			);

			await vi.waitFor(() =>
				expect(error).toHaveBeenCalledWith(
					"A household needs at least one owner. Make another member an owner first.",
				),
			);
			expect(onMembershipChanged).not.toHaveBeenCalled();
		});

		it("removes a member after a confirmation", async () => {
			const { user, writes } = setUp({ respond: () => ({ status: 204 }) });

			await user.click(
				await screen.findByRole("button", { name: "Remove Bob" }),
			);
			expect(writes()).toEqual([]);
			const dialog = within(
				screen.getByRole("alertdialog", {
					name: "Remove Bob from the household?",
				}),
			);
			await user.click(dialog.getByRole("button", { name: "Remove" }));

			await vi.waitFor(() =>
				expect(writes()).toEqual([
					{
						method: "DELETE",
						path: `${base}/members/${BOB_ID}`,
						body: undefined,
					},
				]),
			);
		});

		it("invites someone by email", async () => {
			const success = vi.spyOn(toast, "success").mockImplementation(() => "");
			const { user, writes } = setUp({
				respond: () => ({ status: 201, body: invitation }),
			});

			expect(await screen.findByText("No pending invitation.")).toBeVisible();
			await user.type(screen.getByLabelText("Email"), " Carol@Example.com ");
			await user.click(
				screen.getByRole("button", { name: "Send the invitation" }),
			);

			await vi.waitFor(() =>
				expect(success).toHaveBeenCalledWith(
					"Invitation sent to carol@example.com.",
				),
			);
			expect(writes()).toEqual([
				{
					method: "POST",
					path: `${base}/invitations`,
					body: { email: "carol@example.com" },
				},
			]);
			expect(screen.getByLabelText("Email")).toHaveValue("");
		});

		it("refuses an invalid email without calling the API", async () => {
			const { user, writes } = setUp();

			await user.type(await screen.findByLabelText("Email"), "carol");
			await user.click(
				screen.getByRole("button", { name: "Send the invitation" }),
			);

			expect(
				await screen.findByText("Enter a valid email address."),
			).toBeVisible();
			expect(writes()).toEqual([]);
		});

		it("says when the person invited is already a member", async () => {
			const { user } = setUp({
				respond: () => ({
					status: 409,
					body: { error: { code: "already_member", message: "Member" } },
				}),
			});

			await user.type(await screen.findByLabelText("Email"), "bob@example.com");
			await user.click(
				screen.getByRole("button", { name: "Send the invitation" }),
			);

			expect(await screen.findByRole("alert")).toHaveTextContent(
				"This person is already a member of the household.",
			);
		});

		it("sends a pending invitation again", async () => {
			const success = vi.spyOn(toast, "success").mockImplementation(() => "");
			const { user, writes } = setUp({
				invitations: [invitation],
				respond: () => ({ status: 201, body: invitation }),
			});

			expect(await screen.findByText("Invited by Alice")).toBeVisible();
			await user.click(
				screen.getByRole("button", {
					name: "Send the invitation to carol@example.com again",
				}),
			);

			await vi.waitFor(() => expect(success).toHaveBeenCalledOnce());
			expect(writes()).toEqual([
				{
					method: "POST",
					path: `${base}/invitations`,
					body: { email: "carol@example.com" },
				},
			]);
		});

		it("cancels a pending invitation", async () => {
			const { user, writes } = setUp({
				invitations: [invitation],
				respond: () => ({ status: 204 }),
			});

			await user.click(
				await screen.findByRole("button", {
					name: "Cancel the invitation of carol@example.com",
				}),
			);

			await vi.waitFor(() =>
				expect(writes()).toEqual([
					{
						method: "DELETE",
						path: `${base}/invitations/${INVITATION_ID}`,
						body: undefined,
					},
				]),
			);
		});
	});

	describe("for a plain member", () => {
		it("shows the household without the owners' actions", async () => {
			setUp({ role: "member", invitations: [invitation] });

			expect(await screen.findByText("carol@example.com")).toBeVisible();
			expect(screen.getByText("CAD · Canadian Dollar")).toBeVisible();
			expect(screen.getByText("America / Toronto")).toBeVisible();
			for (const name of [
				"Rename the household",
				"Remove Bob",
				"Send the invitation",
				"Cancel the invitation of carol@example.com",
			]) {
				expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
			}
			expect(screen.queryByLabelText("Currency")).not.toBeInTheDocument();
			expect(screen.queryByLabelText("Time zone")).not.toBeInTheDocument();
			expect(screen.queryByLabelText("Role of Bob")).not.toBeInTheDocument();
			expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
		});

		it("leaves the household after a confirmation", async () => {
			const { user, writes, onMembershipChanged } = setUp({
				role: "member",
				respond: () => ({ status: 204 }),
			});

			const row = await memberRow("Alice");
			await user.click(
				row.getByRole("button", { name: "Leave the household" }),
			);
			const dialog = within(
				screen.getByRole("alertdialog", { name: "Leave The Tremblays?" }),
			);
			await user.click(dialog.getByRole("button", { name: "Leave" }));

			await vi.waitFor(() =>
				expect(onMembershipChanged).toHaveBeenCalledWith(true),
			);
			expect(writes()).toEqual([
				{
					method: "DELETE",
					path: `${base}/members/${aliceProfile.id}`,
					body: undefined,
				},
			]);
		});

		it("can't leave someone else's seat: only their own row has the button", async () => {
			setUp({ role: "member" });

			const row = await memberRow("Bob");

			expect(
				row.queryByRole("button", { name: "Leave the household" }),
			).not.toBeInTheDocument();
		});
	});
});
