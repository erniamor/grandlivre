import type { GettingStarted, Household } from "@repo/schemas";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GettingStartedCard } from "@/features/getting-started/GettingStartedCard";
import { GettingStartedPage } from "@/features/getting-started/GettingStartedPage";
import { type ApiRequest, mockApi } from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

const NOW = "2026-11-16T12:00:00.000Z";

const household: Household = {
	id: "7d6c5b4a-3f2e-4d1c-8b0a-9f8e7d6c5b4a",
	name: "The Tremblays",
	currency: "CAD",
	timeZone: "America/Toronto",
	expenseSharing: false,
	role: "owner",
	createdAt: NOW,
};

const started = (
	steps: Partial<GettingStarted["steps"]> = {},
	hidden = false,
): GettingStarted => ({
	hidden,
	steps: {
		tags: true,
		accounts: false,
		wallet: false,
		members: false,
		imported: false,
		categorized: true,
		recurring: false,
		budgets: false,
		...steps,
	},
	uncategorized: 0,
});

function setUp(status: GettingStarted, role: Household["role"] = "owner") {
	const requests = mockApi((request) => {
		if (request.path.endsWith("/getting-started")) {
			return {
				status: 200,
				body:
					request.method === "PUT"
						? { ...status, ...(request.body as object) }
						: status,
			};
		}
		if (request.path.endsWith("/accounts") && request.method === "POST") {
			return { status: 201, body: { id: "acc" } };
		}
		return undefined;
	});
	return {
		requests,
		user: userEvent.setup(),
		household: { ...household, role },
	};
}

const writes = (requests: ApiRequest[]) =>
	requests.filter((request) => request.method !== "GET");

describe("GettingStartedPage", () => {
	it("lists the steps in order, each done or to do, leading to the page that does it", async () => {
		const { household: owner } = setUp(started());
		renderWithRouter(<GettingStartedPage household={owner} />);

		expect(
			await screen.findByRole("heading", { level: 1, name: "Getting started" }),
		).toBeVisible();
		expect(screen.getByText("Steps done: 1 of 8")).toBeVisible();
		const steps = screen.getAllByRole("listitem");
		expect(
			steps.map((step) => within(step).getByRole("heading").textContent),
		).toEqual([
			"Choose your tags",
			"Add your accounts",
			"Make your wallet",
			"Invite your household",
			"Import your history",
			"Sort your history",
			"Note what comes back",
			"Set budgets",
		]);
		const [tags, accounts, wallet] = steps;
		expect(within(tags as HTMLElement).getByText("Done")).toBeVisible();
		expect(within(accounts as HTMLElement).getByText("To do")).toBeVisible();
		expect(within(wallet as HTMLElement).getByText("Optional")).toBeVisible();
		// The pages it opens bring the user back here
		expect(
			within(accounts as HTMLElement).getByRole("link", {
				name: "Import a statement",
			}),
		).toHaveAttribute("href", "/import?redirect=%2Fgetting-started");
		expect(
			within(accounts as HTMLElement).getByRole("link", {
				name: "Add an account by hand",
			}),
		).toHaveAttribute("href", "/accounts/new?redirect=%2Fgetting-started");
	});

	it("says how many transactions are left to sort, and leads to sorting them", async () => {
		const { household: owner } = setUp({
			...started({ accounts: true, imported: true, categorized: false }),
			uncategorized: 12,
		});
		renderWithRouter(<GettingStartedPage household={owner} />);

		const step = (
			await screen.findByRole("heading", { name: "Sort your history" })
		).closest("li") as HTMLElement;
		expect(within(step).getByText("Left without a tag: 12")).toBeVisible();
		expect(
			within(step).getByRole("link", { name: "Sort by payee" }),
		).toHaveAttribute("href", "/categorize?redirect=%2Fgetting-started");
	});

	it("leaves inviting members to the owners", async () => {
		const { household: member } = setUp(started(), "member");
		renderWithRouter(<GettingStartedPage household={member} />);

		expect(await screen.findByText("Steps done: 1 of 7")).toBeVisible();
		expect(screen.queryByText("Invite your household")).not.toBeInTheDocument();
	});

	it("makes the user's wallet in one go", async () => {
		const { requests, user, household: owner } = setUp(started());
		renderWithRouter(<GettingStartedPage household={owner} />);

		await user.click(
			await screen.findByRole("button", { name: "Make my wallet" }),
		);

		await vi.waitFor(() =>
			expect(writes(requests)).toEqual([
				{
					method: "POST",
					path: `/households/${household.id}/accounts`,
					body: {
						name: "Wallet",
						type: "cash",
						visibility: "details",
						openingBalance: 0,
					},
				},
			]),
		);
	});

	it("puts itself away from the dashboard, and back", async () => {
		const { requests, user, household: owner } = setUp(started());
		renderWithRouter(<GettingStartedPage household={owner} />);

		await user.click(
			await screen.findByRole("button", { name: "Hide from the dashboard" }),
		);

		expect(
			await screen.findByRole("button", { name: "Show on the dashboard" }),
		).toBeVisible();
		expect(writes(requests)).toEqual([
			{
				method: "PUT",
				path: `/households/${household.id}/getting-started`,
				body: { hidden: true },
			},
		]);
	});
});

describe("GettingStartedCard", () => {
	it("shows how far the household got, and the next step", async () => {
		const { household: owner } = setUp(started({ wallet: true }));
		renderWithRouter(<GettingStartedCard household={owner} />);

		const card = within(
			await screen.findByRole("region", { name: "Getting started" }),
		);
		expect(card.getByText("Steps done: 2 of 8")).toBeVisible();
		// The needed steps first, the optional ones after
		expect(card.getByText("Next: Add your accounts")).toBeVisible();
		expect(card.getByRole("link", { name: "Continue" })).toHaveAttribute(
			"href",
			"/getting-started",
		);
	});

	it("is gone once put away, or once every step is done", async () => {
		const everything = {
			tags: true,
			accounts: true,
			wallet: true,
			members: true,
			imported: true,
			recurring: true,
			budgets: true,
		};
		for (const status of [started({}, true), started(everything)]) {
			const { household: owner } = setUp(status);
			const { unmount } = renderWithRouter(
				<GettingStartedCard household={owner} />,
			);
			await vi.waitFor(() =>
				expect(screen.queryByText("Loading")).not.toBeInTheDocument(),
			);
			await new Promise((resolve) => setTimeout(resolve, 50));
			expect(
				screen.queryByRole("region", { name: "Getting started" }),
			).not.toBeInTheDocument();
			unmount();
		}
	});
});
