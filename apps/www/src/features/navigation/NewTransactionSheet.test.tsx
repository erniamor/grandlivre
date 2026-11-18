import type { TransactionDraft } from "@repo/schemas";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppSidebar } from "@/features/navigation/AppSidebar";
import { BottomTabBar } from "@/features/navigation/BottomTabBar";
import { cacheHouseholds } from "@/features/navigation/nav-test-helpers";
import { household } from "@/features/transactions/transaction-test-data";
import { mockApi } from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

const draft: TransactionDraft = {
	type: "expense",
	date: "2026-11-14",
	accountId: null,
	toAccountId: null,
	payee: "Shell",
	note: null,
	lines: [{ amount: 7240, tagId: null, usesProposedTag: false }],
	proposedTag: null,
	remark: null,
	receipt: null,
	warnings: [],
};

async function renderTabBar() {
	const rendered = renderWithRouter(<BottomTabBar />);
	await screen.findByRole("navigation", { name: "Main" });
	cacheHouseholds(rendered.router, [household]);
	await screen.findByRole("button", { name: "New transaction" });
	return rendered;
}

describe("the new transaction button", () => {
	it("sits right in the middle of the tab bar, two tabs on each side, once a household is chosen", async () => {
		await renderTabBar();

		const nav = screen.getByRole("navigation", { name: "Main" });
		expect(
			within(nav)
				.getAllByRole("listitem")
				.map(
					(item) =>
						within(item).queryByRole("link")?.textContent ??
						within(item).getByRole("button").getAttribute("aria-label") ??
						within(item).getByRole("button").textContent,
				),
		).toEqual(["Home", "Transactions", "New transaction", "Reports", "More"]);
	});

	it("isn't offered before a household is chosen", async () => {
		renderWithRouter(<BottomTabBar />);

		await screen.findByRole("navigation", { name: "Main" });

		expect(
			screen.queryByRole("button", { name: "New transaction" }),
		).toBeNull();
	});

	it("opens the quick entry, and the full form for those who'd rather", async () => {
		const user = userEvent.setup();
		await renderTabBar();

		await user.click(screen.getByRole("button", { name: "New transaction" }));

		const sheet = screen.getByRole("dialog", { name: "New transaction" });
		expect(
			within(sheet).getByRole("region", { name: "Quick entry" }),
		).toBeVisible();
		const form = within(sheet).getByRole("link", { name: "Fill in the form" });
		expect(form).toHaveAttribute("href", "/transactions/new");
		await user.click(form);
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("closes when the assistant's draft opens in the form", async () => {
		mockApi(() => ({ status: 200, body: draft }));
		const user = userEvent.setup();
		const { router } = await renderTabBar();

		await user.click(screen.getByRole("button", { name: "New transaction" }));
		await user.type(
			screen.getByLabelText("Describe the transaction"),
			"gas 72.40 yesterday at Shell{Enter}",
		);

		await vi.waitFor(() =>
			expect(router.state.location.pathname).toBe("/transactions/new"),
		);
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("tops the side bar, named in a tooltip where its name doesn't show", async () => {
		const user = userEvent.setup();
		const { router } = renderWithRouter(<AppSidebar />);
		await screen.findByRole("navigation", { name: "Main" });
		cacheHouseholds(router, [household]);

		const button = await screen.findByRole("button", {
			name: "New transaction",
		});
		await user.hover(button);
		expect(await screen.findByRole("tooltip")).toHaveTextContent(
			"New transaction",
		);
		await user.click(button);
		expect(
			screen.getByRole("dialog", { name: "New transaction" }),
		).toBeVisible();
	});
});
