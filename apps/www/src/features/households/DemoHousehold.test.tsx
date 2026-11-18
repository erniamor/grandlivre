import type { Household } from "@repo/schemas";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoBanner } from "@/features/households/DemoBanner";
import { HouseholdMenu } from "@/features/households/HouseholdMenu";
import { HOUSEHOLD_COOKIE } from "@/features/households/preferred-household";
import { TryDemoSection } from "@/features/households/TryDemoSection";
import { readCookie } from "@/lib/cookies";
import { type ApiRequest, mockApi } from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

afterEach(() => {
	// biome-ignore lint/suspicious/noDocumentCookie: clears the cookie the test wrote
	document.cookie = `${HOUSEHOLD_COOKIE}=; path=/; max-age=0`;
});

const NOW = "2026-11-17T12:00:00.000Z";

const real: Household = {
	id: "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f",
	name: "The Tremblays",
	currency: "EUR",
	timeZone: "Europe/Paris",
	expenseSharing: false,
	role: "owner",
	createdAt: NOW,
};

const demo: Household = {
	...real,
	id: "9c8b7a6d-5e4f-4d3c-a2b1-0f9e8d7c6b5a",
	name: "Demo household",
	demo: true,
};

const page = (items: Household[]) => ({
	status: 200,
	body: {
		data: items,
		pagination: { page: 1, pageSize: 50, total: items.length },
	},
});

function setUp(households: Household[] = [real]) {
	return mockApi((request) => {
		if (request.path === "/households" && request.method === "GET") {
			return page(households);
		}
		if (request.path === "/invitations") {
			return page([]);
		}
		if (request.path === "/households/demo") {
			return { status: 201, body: demo };
		}
		if (request.method === "DELETE") {
			return { status: 204 };
		}
		return undefined;
	});
}

const writes = (requests: ApiRequest[]) =>
	requests.filter((request) => request.method !== "GET");

describe("trying with a demo household", () => {
	it("makes one in the browser's time zone, and works on it from now on", async () => {
		const requests = setUp([]);
		const { router } = renderWithRouter(<TryDemoSection />);

		await userEvent.setup().click(
			await screen.findByRole("button", {
				name: "Create the demo household",
			}),
		);

		await vi.waitFor(() =>
			expect(router.state.location.pathname).toBe("/dashboard"),
		);
		expect(writes(requests)).toEqual([
			{
				method: "POST",
				path: "/households/demo",
				body: { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
			},
		]);
		expect(readCookie(document.cookie, HOUSEHOLD_COOKIE)).toBe(demo.id);
	});

	it("is offered in the header, in the current household's currency, and marked Demo", async () => {
		const requests = setUp([real, demo]);
		const user = userEvent.setup();
		renderWithRouter(<HouseholdMenu preferredHousehold={real.id} />);

		await user.click(
			await screen.findByRole("button", { name: "Household: The Tremblays" }),
		);
		const menu = screen.getByRole("menu");
		expect(
			within(menu).getByRole("menuitemradio", { name: /^Demo household/ }),
		).toHaveTextContent("Demo");
		// One exists already: making another starts it over
		await user.click(
			within(menu).getByRole("menuitem", { name: "Start the demo over" }),
		);

		await vi.waitFor(() =>
			expect(writes(requests)).toEqual([
				{
					method: "POST",
					path: "/households/demo",
					body: {
						currency: "EUR",
						timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
					},
				},
			]),
		);
	});
});

describe("DemoBanner", () => {
	it("says the data is made up, and deletes the demo household after a confirmation", async () => {
		const requests = setUp([real]);
		const user = userEvent.setup();
		renderWithRouter(<DemoBanner household={demo} />);

		const banner = within(
			await screen.findByRole("complementary", { name: "Demo" }),
		);
		expect(
			banner.getByText(
				"Demo household: its accounts, transactions and amounts are made up.",
			),
		).toBeVisible();
		await user.click(
			banner.getByRole("button", { name: "Delete the demo household" }),
		);
		await user.click(screen.getByRole("button", { name: "Delete" }));

		await vi.waitFor(() =>
			expect(writes(requests)).toEqual([
				{ method: "DELETE", path: `/households/${demo.id}`, body: undefined },
			]),
		);
	});

	it("shows nothing for a real household", async () => {
		setUp();
		renderWithRouter(
			<>
				<p>Dashboard</p>
				<DemoBanner household={real} />
			</>,
		);

		await screen.findByText("Dashboard");
		expect(
			screen.queryByRole("complementary", { name: "Demo" }),
		).not.toBeInTheDocument();
	});
});
