import type { RecurringTransaction } from "@repo/schemas";
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import {
	base,
	bobsCard,
	chequing,
	household,
	page,
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

	describe("the recurring transactions", () => {
		const NOW = "2026-11-15T12:00:00.000Z";
		const hydro: RecurringTransaction = {
			id: "00000000-0000-4000-8000-000000000061",
			householdId: household.id,
			transaction: {
				type: "expense",
				accountId: chequing.id,
				toAccountId: null,
				amount: 9_000,
				payee: "Hydro",
				note: null,
				lines: [{ amount: 9_000, tagId: null }],
			},
			schedule: {
				unit: "month",
				interval: 2,
				startDate: "2026-11-10",
				endDate: null,
			},
			mode: "confirm",
			nextDate: "2027-01-10",
			createdBy: null,
			createdAt: NOW,
			updatedAt: NOW,
		};
		const bobsGym: RecurringTransaction = {
			...hydro,
			id: "00000000-0000-4000-8000-000000000062",
			transaction: {
				...hydro.transaction,
				accountId: bobsCard.id,
				payee: "Gym",
			},
		};
		const OCCURRENCE = "00000000-0000-4000-8000-000000000071";

		function mockRecurring() {
			const reads = respondWith();
			mockApi((request) => {
				if (request.path === `${base}/recurring-transactions/pending`) {
					return page([
						{ id: OCCURRENCE, date: "2026-11-10", recurring: hydro },
						{
							id: "00000000-0000-4000-8000-000000000072",
							date: "2026-11-12",
							recurring: bobsGym,
						},
					]);
				}
				if (request.path === `${base}/recurring-transactions/upcoming`) {
					return page(
						[
							{
								date: "2027-01-10",
								recurring: { ...hydro, mode: "automatic" },
							},
						],
						{ total: 4 },
					);
				}
				return reads(request);
			});
		}

		it("lists the days waiting, to check and record or skip, on the accounts the user holds", async () => {
			mockRecurring();

			renderWithRouter(
				<DashboardPage me={aliceProfile} household={household} />,
			);

			const waiting = within(
				await screen.findByRole("region", { name: "To confirm" }),
			);
			expect(waiting.getByText("Hydro")).toBeVisible();
			expect(waiting.getByText("Tuesday, November 10, 2026")).toBeVisible();
			expect(
				waiting.getByRole("link", { name: "Check and record Hydro" }),
			).toHaveAttribute("href", `/recurring/pending/${OCCURRENCE}`);
			expect(waiting.getByRole("button", { name: "Skip Hydro" })).toBeVisible();
			// Bob's: shown, but only Bob can record or skip it
			expect(waiting.getByText("Gym")).toBeVisible();
			expect(
				waiting.queryByRole("button", { name: "Skip Gym" }),
			).not.toBeInTheDocument();
		});

		it("shows the first days to come, and how many more", async () => {
			mockRecurring();

			renderWithRouter(
				<DashboardPage me={aliceProfile} household={household} />,
			);

			const upcoming = within(
				await screen.findByRole("region", { name: "In the next 30 days" }),
			);
			expect(
				upcoming.getByText("Sunday, January 10, 2027 · Automatic"),
			).toBeVisible();
			expect(upcoming.getByText("And 3 more.")).toBeVisible();
			expect(
				upcoming.getByRole("link", { name: "See the recurring transactions" }),
			).toHaveAttribute("href", "/recurring");
		});

		it("shows neither when none waits nor comes", async () => {
			mockSummary();

			renderWithRouter(
				<DashboardPage me={aliceProfile} household={household} />,
			);

			await screen.findByRole("heading", { level: 1, name: "Dashboard" });
			expect(
				screen.queryByRole("region", { name: "To confirm" }),
			).not.toBeInTheDocument();
			expect(
				screen.queryByRole("region", { name: "In the next 30 days" }),
			).not.toBeInTheDocument();
		});
	});
});
