import type { BudgetsMonth } from "@repo/schemas";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BudgetPage } from "@/features/budgets/BudgetPage";
import { BudgetsPage } from "@/features/budgets/BudgetsPage";
import {
	base,
	food,
	gas,
	household,
	page,
	tags,
} from "@/features/transactions/transaction-test-data";
import { setTestLocale } from "@/test/locale";
import { type ApiRequest, type ApiResponse, mockApi } from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

const NOW = "2026-11-15T12:00:00.000Z";

const foodBudget = {
	tagId: food.id,
	period: "month" as const,
	amount: 50_000,
	since: "2026-09",
	spent: 16_000,
	upcoming: 2_000,
};

const november: BudgetsMonth = {
	month: "2026-11",
	budgets: [
		foodBudget,
		{
			tagId: gas.id,
			period: "month",
			amount: 20_000,
			since: "2026-11",
			spent: 23_000,
			upcoming: 0,
		},
	],
};

function api(
	month: BudgetsMonth = november,
	respond: (request: ApiRequest) => ApiResponse | undefined = () => undefined,
) {
	return mockApi((request) => {
		if (request.method === "GET" && request.path === `${base}/tags`) {
			return page(tags, { pageSize: 500 });
		}
		if (request.method === "GET" && request.path === `${base}/budgets`) {
			return { status: 200, body: month };
		}
		return respond(request);
	});
}

const writes = (requests: ApiRequest[]) =>
	requests.filter((request) => request.method !== "GET");

const row = async (name: string) =>
	within(
		(await screen.findByRole("link", { name })).closest("li") as HTMLElement,
	);

describe("BudgetsPage", () => {
	it.each([
		[
			"en",
			"Budgets",
			"November 2026",
			"$160.00 spent of $500.00",
			"$340.00 left",
		],
		[
			"fr",
			"Budgets",
			"novembre 2026",
			"160,00 $ dépensés sur 500,00 $",
			"Reste 340,00 $",
		],
	] as const)(
		"shows where each budget stands in the month, in %s",
		async (locale, title, month, spent, left) => {
			setTestLocale(locale);
			api();
			renderWithRouter(<BudgetsPage household={household} month="2026-11" />);

			expect(
				await screen.findByRole("heading", { level: 1, name: title }),
			).toBeVisible();
			expect(screen.getByText(month)).toBeVisible();
			const name = locale === "en" ? "Food" : "Alimentation";
			const item = await row(name);
			expect(item.getByText(spent)).toBeVisible();
			expect(item.getByText(left)).toBeVisible();
		},
	);

	it("says in words, with an icon, a budget that is over", async () => {
		api();
		renderWithRouter(<BudgetsPage household={household} month="2026-11" />);

		expect((await row("Gas")).getByText("Over by $30.00")).toBeVisible();
	});

	it("says a budget will be over with what is planned", async () => {
		api({
			month: "2026-11",
			budgets: [{ ...foodBudget, spent: 45_000, upcoming: 10_000 }],
		});
		renderWithRouter(<BudgetsPage household={household} month="2026-11" />);

		const item = await row("Food");
		expect(item.getByText(/\$100.00 planned/)).toBeVisible();
		expect(
			item.getByText("Will be over by $50.00 with what is planned"),
		).toBeVisible();
	});

	it("adds up the monthly budgets", async () => {
		api();
		renderWithRouter(<BudgetsPage household={household} month="2026-11" />);

		const total = within(
			await screen.findByRole("region", { name: "All the monthly budgets" }),
		);
		expect(total.getByText(/\$390.00 spent of \$700.00/)).toBeVisible();
	});

	it("links to the months around, to add a budget, and to each budget, keeping the month", async () => {
		api();
		renderWithRouter(<BudgetsPage household={household} month="2026-12" />);

		expect(
			await screen.findByRole("link", { name: "Previous month" }),
		).toHaveAttribute("href", "/budgets?month=2026-11");
		expect(screen.getByRole("link", { name: "Next month" })).toHaveAttribute(
			"href",
			"/budgets?month=2027-01",
		);
		expect(screen.getByRole("link", { name: "Add a budget" })).toHaveAttribute(
			"href",
			"/budgets/new?month=2026-12",
		);
		expect(screen.getByRole("link", { name: "Food" })).toHaveAttribute(
			"href",
			`/budgets/${food.id}?month=2026-12`,
		);
	});

	it("says when the month has no budget", async () => {
		api({ month: "2026-11", budgets: [] });
		renderWithRouter(<BudgetsPage household={household} month="2026-11" />);

		expect(await screen.findByText("No budget this month.")).toBeVisible();
		expect(
			screen.queryByRole("region", { name: "All the monthly budgets" }),
		).not.toBeInTheDocument();
	});
});

describe("BudgetPage", () => {
	function setUp(
		tagId: string | undefined,
		respond: (request: ApiRequest) => ApiResponse | undefined = (request) =>
			request.method === "PUT"
				? {
						status: 200,
						body: {
							tagId: food.id,
							period: "month",
							amount: 1,
							from: "2026-11",
							updatedAt: NOW,
						},
					}
				: undefined,
	) {
		const requests = api(november, (request) => {
			if (request.path.endsWith("/suggestion")) {
				return {
					status: 200,
					body: { tagId: gas.id, month: 18_050, year: 210_000 },
				};
			}
			return respond(request);
		});
		const onDone = vi.fn();
		renderWithRouter(
			<BudgetPage
				household={household}
				month="2026-11"
				tagId={tagId}
				onDone={onDone}
			/>,
		);
		return { requests, onDone, user: userEvent.setup() };
	}

	it("adds a budget on the tag chosen, from the month shown, starting from what it usually costs", async () => {
		const { requests, onDone, user } = setUp(undefined);

		await user.selectOptions(await screen.findByLabelText("Tag"), "Gas");
		expect(
			await screen.findByText("Usually $180.50 a month (the last 3 months)."),
		).toBeVisible();
		await user.click(screen.getByRole("button", { name: "Use this amount" }));
		expect(screen.getByLabelText("Amount per month")).toHaveValue("180.50");
		await user.click(screen.getByRole("radio", { name: /^Each year/ }));
		expect(
			await screen.findByText("$2,100.00 over the last 12 months."),
		).toBeVisible();
		await user.clear(screen.getByLabelText("Amount per year"));
		await user.type(screen.getByLabelText("Amount per year"), "2400");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
		expect(writes(requests)).toEqual([
			{
				method: "PUT",
				path: `${base}/budgets/${gas.id}`,
				body: { period: "year", amount: 240_000, from: "2026-11" },
			},
		]);
	});

	it("asks for a tag and an amount before saving", async () => {
		const { requests, user } = setUp(undefined);

		await user.click(await screen.findByRole("button", { name: "Save" }));

		expect(
			await screen.findByText("Choose the tag of the budget."),
		).toBeVisible();
		expect(writes(requests)).toEqual([]);
	});

	it("changes a tag's budget as it stands in the month", async () => {
		const { requests, onDone, user } = setUp(food.id);

		expect(
			await screen.findByRole("heading", { level: 1, name: "Budget: Food" }),
		).toBeVisible();
		const amount = screen.getByLabelText("Amount per month");
		expect(amount).toHaveValue("500.00");
		expect(screen.queryByLabelText("Tag")).not.toBeInTheDocument();
		await user.clear(amount);
		await user.type(amount, "550");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
		expect(writes(requests)).toEqual([
			{
				method: "PUT",
				path: `${base}/budgets/${food.id}`,
				body: { period: "month", amount: 55_000, from: "2026-11" },
			},
		]);
	});

	it("stops it from the month shown, after a confirmation", async () => {
		const { requests, onDone, user } = setUp(food.id, (request) =>
			request.method === "DELETE" ? { status: 204 } : undefined,
		);

		await user.click(
			await screen.findByRole("button", { name: "Stop this budget" }),
		);
		expect(
			screen.getByText(
				"From November 2026, this tag has no budget. The months before keep it.",
			),
		).toBeVisible();
		await user.click(screen.getByRole("button", { name: "Stop" }));

		await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
		expect(writes(requests)).toEqual([
			{
				method: "DELETE",
				path: `${base}/budgets/${food.id}`,
				body: undefined,
			},
		]);
	});
});
