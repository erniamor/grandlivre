import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { setTestLocale } from "@/test/locale";
import { aliceProfile, mockApi } from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

const household = {
	id: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
	name: "The Tremblays",
	currency: "CAD",
	role: "owner",
	createdAt: "2026-11-14T12:00:00.000Z",
} as const;

function mockSummary() {
	mockApi(() => ({
		status: 200,
		body: { assets: 1_125_050, liabilities: -45_000, balance: 1_080_050 },
	}));
}

describe("DashboardPage", () => {
	it.each([
		["en", "Dashboard", "Household: The Tremblays"],
		["fr", "Tableau de bord", "Foyer : The Tremblays"],
		["es", "Panel", "Hogar: The Tremblays"],
	] as const)(
		"greets the signed-in user in their household, in %s",
		async (locale, title, householdLine) => {
			setTestLocale(locale);
			mockSummary();

			renderWithRouter(
				<DashboardPage me={aliceProfile} household={household} />,
			);

			expect(
				await screen.findByRole("heading", { level: 1, name: title }),
			).toBeVisible();
			expect(screen.getByText("Alice")).toBeVisible();
			expect(screen.getByText(householdLine)).toBeVisible();
		},
	);

	it("shows the email of a user without a name", async () => {
		mockSummary();

		renderWithRouter(
			<DashboardPage
				me={{ ...aliceProfile, name: "" }}
				household={household}
			/>,
		);

		expect(await screen.findByText("alice@example.com")).toBeVisible();
	});

	it("shows the household's consolidated balance, with a link to the accounts", async () => {
		mockSummary();

		renderWithRouter(<DashboardPage me={aliceProfile} household={household} />);

		const balance = within(
			await screen.findByRole("region", { name: "Household balance" }),
		);
		expect(balance.getByText("$10,800.50")).toBeVisible();
		expect(balance.getByText("$11,250.50")).toBeVisible();
		expect(balance.getByText("-$450.00")).toBeVisible();
		expect(
			balance.getByRole("link", { name: "See the accounts" }),
		).toHaveAttribute("href", "/accounts");
	});
});
