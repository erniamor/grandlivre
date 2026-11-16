import type { Household, Tag, UncategorizedPayee } from "@repo/schemas";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CategorizePage } from "@/features/categorize/CategorizePage";
import { type ApiRequest, mockApi } from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

const NOW = "2026-11-16T12:00:00.000Z";
const FUEL = "4d5e6f7a-8b9c-4d0e-9f2a-3b4c5d6e7f8a";

const household: Household = {
	id: "7d6c5b4a-3f2e-4d1c-8b0a-9f8e7d6c5b4a",
	name: "The Tremblays",
	currency: "CAD",
	timeZone: "America/Toronto",
	expenseSharing: false,
	role: "owner",
	createdAt: NOW,
};

const tags: Tag[] = [
	{
		id: FUEL,
		householdId: household.id,
		names: { en: "Fuel" },
		parentId: null,
		createdAt: NOW,
	},
];

const costco: UncategorizedPayee = {
	key: "costcoessencew",
	payee: "COSTCO ESSENCE W100",
	type: "expense",
	count: 34,
	total: 2_480_00,
	firstDate: "2025-06-02",
	lastDate: "2026-11-10",
};

const refund: UncategorizedPayee = {
	...costco,
	type: "income",
	count: 2,
	total: 12_50,
};

function setUp(groups: UncategorizedPayee[]) {
	const requests = mockApi((request) => {
		if (request.path.endsWith("/transactions/uncategorized")) {
			return {
				status: 200,
				body: {
					data: groups,
					pagination: { page: 1, pageSize: 200, total: groups.length },
				},
			};
		}
		if (request.path.endsWith("/tags")) {
			return {
				status: 200,
				body: { data: tags, pagination: { page: 1, pageSize: 500, total: 1 } },
			};
		}
		if (request.path.endsWith("/transactions/categorize")) {
			return { status: 200, body: { count: 34 } };
		}
		return undefined;
	});
	renderWithRouter(<CategorizePage household={household} />);
	return { requests, user: userEvent.setup() };
}

const writes = (requests: ApiRequest[]) =>
	requests.filter((request) => request.method !== "GET");

describe("CategorizePage", () => {
	it("lists the payees without a tag, the expenses and the refunds apart", async () => {
		setUp([costco, refund]);

		expect(await screen.findByText("Payees to sort: 2")).toBeVisible();
		const [expenses, incomes] = screen.getAllByRole("listitem");
		expect(
			within(expenses as HTMLElement).getByRole("heading"),
		).toHaveTextContent("COSTCO ESSENCE W100");
		expect(
			within(expenses as HTMLElement).getByText(
				"Expenses: 34 · from Jun 2, 2025 to Nov 10, 2026",
			),
		).toBeVisible();
		expect(
			within(expenses as HTMLElement).getByText("$2,480.00"),
		).toBeVisible();
		expect(
			within(incomes as HTMLElement).getByText(
				"Incomes and refunds: 2 · from Jun 2, 2025 to Nov 10, 2026",
			),
		).toBeVisible();
	});

	it("tags all of a payee's transactions once a tag is chosen", async () => {
		const { requests, user } = setUp([costco]);
		const sort = await screen.findByRole("button", { name: "Sort" });

		expect(sort).toBeDisabled();
		await user.selectOptions(
			screen.getByRole("combobox", { name: "Tag for COSTCO ESSENCE W100" }),
			"Fuel",
		);
		await user.click(sort);

		await vi.waitFor(() =>
			expect(writes(requests)).toEqual([
				{
					method: "POST",
					path: `/households/${household.id}/transactions/categorize`,
					body: { key: "costcoessencew", type: "expense", tagId: FUEL },
				},
			]),
		);
	});

	it("says when nothing is left to sort", async () => {
		setUp([]);

		expect(
			await screen.findByText(
				"Nothing left to sort: every expense and income of your accounts has a tag.",
			),
		).toBeVisible();
	});
});
