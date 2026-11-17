import type { Household, ReceivedInvitation } from "@repo/schemas";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HouseholdMenu } from "@/features/households/HouseholdMenu";
import { HOUSEHOLD_COOKIE } from "@/features/households/preferred-household";
import { readCookie } from "@/lib/cookies";
import { setTestLocale } from "@/test/locale";
import { mockApi } from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

afterEach(() => {
	// biome-ignore lint/suspicious/noDocumentCookie: clears the cookie the test wrote
	document.cookie = `${HOUSEHOLD_COOKIE}=; path=/; max-age=0`;
});

const NOW = "2026-11-16T12:00:00.000Z";

const tremblays: Household = {
	id: "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f",
	name: "The Tremblays",
	currency: "CAD",
	timeZone: "America/Toronto",
	expenseSharing: false,
	role: "owner",
	createdAt: NOW,
};

const cottage: Household = {
	...tremblays,
	id: "9c8b7a6d-5e4f-4d3c-a2b1-0f9e8d7c6b5a",
	name: "The cottage",
	role: "member",
};

const invitation: ReceivedInvitation = {
	id: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
	household: {
		id: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
		name: "The Gagnons",
	},
	invitedByName: "Bob",
	expiresAt: NOW,
};

const page = <T,>(items: T[]) => ({
	status: 200,
	body: {
		data: items,
		pagination: { page: 1, pageSize: 50, total: items.length },
	},
});

function setUp(
	households: Household[],
	invitations: ReceivedInvitation[] = [],
	preferred?: string,
) {
	const requests = mockApi((request) => {
		if (request.path === "/households") {
			return page(households);
		}
		if (request.path === "/invitations") {
			return page(invitations);
		}
		return undefined;
	});
	const rendered = renderWithRouter(
		<HouseholdMenu preferredHousehold={preferred} />,
	);
	return { ...rendered, requests, user: userEvent.setup() };
}

describe("HouseholdMenu", () => {
	it("shows the household chosen on this device, and lists the user's households with their role", async () => {
		const { user } = setUp([tremblays, cottage], [], cottage.id);

		await user.click(
			await screen.findByRole("button", { name: "Household: The cottage" }),
		);

		const menu = screen.getByRole("menu");
		expect(
			within(menu)
				.getAllByRole("menuitemradio")
				.map((item) => [item.textContent, item.getAttribute("aria-checked")]),
		).toEqual([
			["The TremblaysOwner", "false"],
			["The cottageMember", "true"],
		]);
		expect(
			within(menu).getByRole("menuitem", {
				name: "Create or join a household",
			}),
		).toHaveAttribute("href", "/setup");
	});

	it("switches to another household and opens its dashboard", async () => {
		const { router, user } = setUp([tremblays, cottage]);

		await user.click(
			await screen.findByRole("button", { name: "Household: The Tremblays" }),
		);
		await user.click(
			screen.getByRole("menuitemradio", { name: /^The cottage/ }),
		);

		expect(readCookie(document.cookie, HOUSEHOLD_COOKIE)).toBe(cottage.id);
		await expect.poll(() => router.state.location.pathname).toBe("/dashboard");
	});

	it("tells about the invitations received, in French", async () => {
		setTestLocale("fr");
		const { user } = setUp([tremblays], [invitation]);

		await user.click(
			await screen.findByRole("button", {
				name: "Foyer : The Tremblays. Invitations reçues : 1",
			}),
		);

		expect(
			screen.getByRole("menuitem", { name: "Invitations reçues (1)" }),
		).toHaveAttribute("href", "/setup");
	});

	it("shows nothing to a user without a household", async () => {
		const { container, requests } = setUp([]);

		await vi.waitFor(() =>
			expect(requests.map(({ path }) => path)).toContain("/households"),
		);
		expect(within(container).queryByRole("button")).not.toBeInTheDocument();
	});
});
