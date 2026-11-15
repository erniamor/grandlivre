import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import {
	base,
	household,
	respondWith,
	transactions,
} from "@/features/transactions/transaction-test-data";
import { setTestLocale } from "@/test/locale";
import { aliceProfile, mockApi } from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

function mockSummary(items = transactions) {
	const urls: URL[] = [];
	mockApi((request, url) => {
		urls.push(url);
		return respondWith(items)(request);
	});
	return urls;
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

	it("shows the latest transactions, with a link to all of them", async () => {
		const urls = mockSummary();

		renderWithRouter(<DashboardPage me={aliceProfile} household={household} />);

		const latest = within(
			await screen.findByRole("region", { name: "Latest transactions" }),
		);
		expect(latest.getByText("Shell")).toBeVisible();
		expect(latest.getByText("-$72.00")).toBeVisible();
		expect(
			latest.getByRole("link", { name: "See all transactions" }),
		).toHaveAttribute("href", "/transactions");
		expect(
			latest.getByRole("link", { name: "Add a transaction" }),
		).toHaveAttribute("href", "/transactions/new");
		expect(
			urls.find((url) => url.pathname.endsWith(`${base}/transactions`))?.search,
		).toBe("?page=1&pageSize=5");
	});

	it("offers the quick entry", async () => {
		mockSummary();

		renderWithRouter(<DashboardPage me={aliceProfile} household={household} />);

		expect(
			await screen.findByRole("region", { name: "Quick entry" }),
		).toBeVisible();
		expect(screen.getByLabelText("Describe the transaction")).toBeVisible();
	});

	it("says when the household has no transaction yet", async () => {
		mockSummary([]);

		renderWithRouter(<DashboardPage me={aliceProfile} household={household} />);

		expect(await screen.findByText("No transaction yet.")).toBeVisible();
	});
});
