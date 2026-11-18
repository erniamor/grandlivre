import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { BottomTabBar } from "@/features/navigation/BottomTabBar";
import { cacheHouseholds } from "@/features/navigation/nav-test-helpers";
import { household } from "@/features/transactions/transaction-test-data";
import { setTestLocale } from "@/test/locale";
import { renderWithRouter } from "@/test/render-with-router";

describe("BottomTabBar", () => {
	it("shows four pages, each its icon above a short name, then More", async () => {
		setTestLocale("fr");
		renderWithRouter(<BottomTabBar />);

		const nav = await screen.findByRole("navigation", { name: "Principale" });
		expect(
			within(nav)
				.getAllByRole("link")
				.map((link) => [link.textContent, link.getAttribute("href")]),
		).toEqual([
			["Accueil", "/dashboard"],
			["Transactions", "/transactions"],
			["Budgets", "/budgets"],
			["Rapports", "/reports"],
		]);
		expect(within(nav).getByRole("button", { name: "Plus" })).toHaveAttribute(
			"aria-haspopup",
			"dialog",
		);
	});

	it("opens the other pages from More, and closes when one is chosen", async () => {
		const user = userEvent.setup();
		const { router } = renderWithRouter(<BottomTabBar />);
		await screen.findByRole("navigation", { name: "Main" });
		cacheHouseholds(router, [{ ...household, expenseSharing: true }]);

		await user.click(screen.getByRole("button", { name: "More" }));

		const sheet = screen.getByRole("dialog", { name: "More" });
		expect(
			within(sheet)
				.getAllByRole("link")
				.map((link) => link.getAttribute("href")),
		).toEqual([
			"/recurring",
			"/accounts",
			"/tags",
			"/shared",
			"/import",
			"/help",
		]);
		await user.click(within(sheet).getByRole("link", { name: "Accounts" }));
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("closes More with its button", async () => {
		const user = userEvent.setup();
		renderWithRouter(<BottomTabBar />);

		await user.click(await screen.findByRole("button", { name: "More" }));
		await user.click(screen.getByRole("button", { name: "Close" }));

		expect(screen.queryByRole("dialog")).toBeNull();
	});
});
