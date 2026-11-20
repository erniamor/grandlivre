import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppSidebar } from "@/features/navigation/AppSidebar";
import { cacheHouseholds } from "@/features/navigation/nav-test-helpers";
import { household } from "@/features/transactions/transaction-test-data";
import { renderWithRouter } from "@/test/render-with-router";

describe("AppSidebar", () => {
	it("links to every page of the app, each with its name", async () => {
		renderWithRouter(<AppSidebar />);

		const nav = await screen.findByRole("navigation", { name: "Main" });
		expect(
			within(nav)
				.getAllByRole("link")
				.map((link) => [link.textContent, link.getAttribute("href")]),
		).toEqual([
			["Dashboard", "/dashboard"],
			["Transactions", "/transactions"],
			["Recurring", "/recurring"],
			["Budgets", "/budgets"],
			["Reports", "/reports"],
			["Accounts", "/accounts"],
			["Tags", "/tags"],
			["Import", "/import"],
			["Settings", "/household"],
			["Help", "/help"],
		]);
	});

	it("adds the sharing page for a household that settles shared expenses", async () => {
		const { router } = renderWithRouter(<AppSidebar />);
		await screen.findByRole("navigation", { name: "Main" });

		cacheHouseholds(router, [{ ...household, expenseSharing: true }]);

		expect(
			await screen.findByRole("link", { name: "Sharing" }),
		).toHaveAttribute("href", "/shared");
	});

	it("names each page in a tooltip, for the icons shown alone on a tablet", async () => {
		const user = userEvent.setup();
		renderWithRouter(<AppSidebar />);

		await user.hover(await screen.findByRole("link", { name: "Budgets" }));

		expect(await screen.findByRole("tooltip")).toHaveTextContent("Budgets");
	});
});
