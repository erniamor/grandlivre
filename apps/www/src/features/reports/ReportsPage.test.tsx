import type { MonthlyReport, Tag, TagReport } from "@repo/schemas";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	monthPeriod,
	type Period,
	yearPeriod,
} from "@/features/reports/period";
import { ReportsPage } from "@/features/reports/ReportsPage";
import {
	base,
	household,
	page,
} from "@/features/transactions/transaction-test-data";
import { setTestLocale } from "@/test/locale";
import { mockApi } from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

const NOW = "2026-11-14T12:00:00.000Z";
const id = (n: number) =>
	`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function tag(n: number, names: Tag["names"], parent?: Tag): Tag {
	return {
		id: id(n),
		householdId: household.id,
		names,
		parentId: parent?.id ?? null,
		createdAt: NOW,
	};
}

const food = tag(1, { en: "Food", fr: "Alimentation", es: "Alimentación" });
const groceries = tag(
	2,
	{ en: "Groceries", fr: "Épicerie", es: "Supermercado" },
	food,
);
const restaurant = tag(
	3,
	{ en: "Restaurant", fr: "Restaurant", es: "Restaurante" },
	food,
);
const car = tag(4, { en: "Car", fr: "Voiture", es: "Coche" });
const salary = tag(5, { en: "Salary", fr: "Salaire", es: "Salario" });
const tags = [food, groceries, restaurant, car, salary];

const november = monthPeriod(2026, 11);

/**
 * November: groceries 400.00 with a refund of 30.00, restaurant 120.00, the
 * car 50.00, the salary 2,500.00; and 15.00 spent and 100.00 received
 * without a tag.
 */
const novemberReport: TagReport = {
	...november,
	tags: [
		{ tagId: groceries.id, undetermined: false, expense: 40_000, income: 3000 },
		{ tagId: restaurant.id, undetermined: false, expense: 12_000, income: 0 },
		{ tagId: car.id, undetermined: false, expense: 5000, income: 0 },
		{ tagId: salary.id, undetermined: false, expense: 0, income: 250_000 },
		{ tagId: null, undetermined: false, expense: 1500, income: 10_000 },
	],
};

/**
 * Twelve months to November: October with the car, November as above; the
 * other months empty.
 */
const months: MonthlyReport = {
	months: Array.from({ length: 12 }, (_, index) => {
		const month = `${index === 0 ? 2025 : 2026}-${String(index === 0 ? 12 : index).padStart(2, "0")}`;
		if (month === "2026-10") {
			const tags = [
				{ tagId: car.id, undetermined: false, expense: 20_000, income: 0 },
			];
			return { month, expense: 20_000, income: 0, tags };
		}
		if (month === "2026-11") {
			return {
				month,
				expense: 58_500,
				income: 263_000,
				tags: novemberReport.tags,
			};
		}
		return { month, expense: 0, income: 0, tags: [] };
	}),
};

function setUp(
	report: TagReport = novemberReport,
	period: Period = november,
	monthly: MonthlyReport = months,
) {
	const urls: URL[] = [];
	mockApi((request, url) => {
		urls.push(url);
		if (request.path === `${base}/reports/tags`) {
			return { status: 200, body: report };
		}
		if (request.path === `${base}/reports/monthly`) {
			return { status: 200, body: monthly };
		}
		if (request.path === `${base}/tags`) {
			return page(tags, { pageSize: 500 });
		}
		return undefined;
	});
	const onPeriodChange = vi.fn();
	renderWithRouter(
		<ReportsPage
			household={household}
			period={period}
			onPeriodChange={onPeriodChange}
		/>,
	);
	return {
		user: userEvent.setup(),
		onPeriodChange,
		/** The query string of the report asked for. */
		reportQuery: () =>
			urls.find((url) => url.pathname.endsWith("/reports/tags"))?.search,
	};
}

const section = (name: string) =>
	screen.findByRole("region", { name }).then((region) => within(region));

/** The row of a tag or of the uncategorized lines, in a section. */
function row(region: Awaited<ReturnType<typeof section>>, name: string) {
	const label = region.getByText(name);
	const line = label.closest("summary") ?? label.closest("li");
	if (!line) {
		throw new Error(`No row for ${name}`);
	}
	// The texts of the row, piece by piece: name, share, amount
	return Array.from(line.querySelectorAll("span"))
		.filter((piece) => piece.children.length === 0 && piece.textContent)
		.map((piece) => piece.textContent?.replace(/\s/g, " "))
		.join(" ");
}

describe("ReportsPage", () => {
	it.each([
		["en", "Reports", "November 2026", "Expenses", "Income"],
		["fr", "Rapports", "novembre 2026", "Dépenses", "Revenus"],
		["es", "Informes", "noviembre de 2026", "Gastos", "Ingresos"],
	] as const)(
		"shows the period's report, in %s",
		async (locale, title, month, expenses, incomes) => {
			setTestLocale(locale);
			const { reportQuery } = setUp();

			expect(
				await screen.findByRole("heading", { level: 1, name: title }),
			).toBeVisible();
			// The period picker's label, not the table of figures
			expect(screen.getByText(month, { selector: "p" })).toBeVisible();
			expect(await section(expenses)).toBeDefined();
			expect(await section(incomes)).toBeDefined();
			expect(reportQuery()).toBe("?from=2026-11-01&to=2026-11-30");
		},
	);

	it("sums the period up: what came in, what went out, what is left", async () => {
		setUp();

		const summary = within(
			(await screen.findByText("Balance of the period")).closest(
				"dl",
			) as HTMLElement,
		);

		// 2,500.00 + 100.00; 370.00 + 120.00 + 50.00 + 15.00
		expect(summary.getByText("$2,600.00")).toBeVisible();
		expect(summary.getByText("$555.00")).toBeVisible();
		expect(summary.getByText("+$2,045.00")).toBeVisible();
	});

	it("shows each tag with its sub-tags added, its refunds taken off, the biggest first", async () => {
		setUp();

		const expenses = await section("Expenses");

		expect(row(expenses, "Food")).toBe("› Food 88% $490.00");
		expect(row(expenses, "Car")).toBe("Car 9% $50.00");
		expect(row(expenses, "Uncategorized")).toBe("Uncategorized 3% $15.00");
		expect(
			expenses
				.getAllByText(/^(Food|Car|Uncategorized)$/)
				.map((each) => each.textContent),
		).toEqual(["Food", "Car", "Uncategorized"]);
	});

	it("opens a tag to show its sub-tags", async () => {
		const { user } = setUp();

		const expenses = await section("Expenses");
		const groceriesRow = expenses.getByText("Groceries");
		expect(groceriesRow).not.toBeVisible();

		await user.click(expenses.getByText("Food"));

		expect(groceriesRow).toBeVisible();
		expect(row(expenses, "Groceries")).toBe("Groceries 67% $370.00");
		expect(row(expenses, "Restaurant")).toBe("Restaurant 22% $120.00");
	});

	it("lists the incomes apart, uncategorized ones included", async () => {
		setUp();

		const incomes = await section("Income");

		expect(row(incomes, "Salary")).toBe("Salary 96% $2,500.00");
		expect(row(incomes, "Uncategorized")).toBe("Uncategorized 4% $100.00");
		expect(incomes.queryByText("Food")).not.toBeInTheDocument();
	});

	it("links each tag to its transactions over the period, but not the uncategorized lines", async () => {
		const { user } = setUp();

		const expenses = await section("Expenses");
		// Opening the tag, on its name, doesn't follow the link
		await user.click(expenses.getByText("Food"));
		expect(expenses.getByText("Groceries")).toBeVisible();

		expect(
			expenses.getByRole("link", {
				name: "See the transactions of Food over this period",
			}),
		).toHaveAttribute(
			"href",
			`/transactions?tag=${food.id}&from=2026-11-01&to=2026-11-30`,
		);
		expect(
			expenses.getByRole("link", {
				name: "See the transactions of Groceries over this period",
			}),
		).toHaveAttribute(
			"href",
			`/transactions?tag=${groceries.id}&from=2026-11-01&to=2026-11-30`,
		);
		expect(
			expenses.queryByRole("link", { name: /Uncategorized/ }),
		).not.toBeInTheDocument();
	});

	it("says when a section has nothing", async () => {
		setUp({
			...novemberReport,
			tags: [{ tagId: car.id, undetermined: false, expense: 5000, income: 0 }],
		});

		expect(
			(await section("Income")).getByText("No income in this period."),
		).toBeVisible();
	});

	it("says when the period has no transaction", async () => {
		setUp({ ...november, tags: [] });

		expect(
			await screen.findByText("No transaction in this period."),
		).toBeVisible();
		expect(
			screen.queryByRole("region", { name: "Expenses" }),
		).not.toBeInTheDocument();
	});

	it("says that every account counts, those whose balance only the user sees included", async () => {
		setUp();

		expect(
			await screen.findByText(/^Reports count every account of the household/),
		).toBeVisible();
	});

	describe("the period", () => {
		it("moves to the month before or after", async () => {
			const { user, onPeriodChange } = setUp();

			await user.click(
				await screen.findByRole("button", { name: "Previous period" }),
			);
			expect(onPeriodChange).toHaveBeenLastCalledWith(monthPeriod(2026, 10));
			await user.click(screen.getByRole("button", { name: "Next period" }));
			expect(onPeriodChange).toHaveBeenLastCalledWith(monthPeriod(2026, 12));
		});

		it("switches to the year of the month shown, and back to its first month", async () => {
			const { user, onPeriodChange } = setUp();

			await user.click(await screen.findByRole("radio", { name: "Year" }));
			expect(onPeriodChange).toHaveBeenLastCalledWith(yearPeriod(2026));
		});

		it("moves a year back and forth", async () => {
			const { user, onPeriodChange } = setUp(
				{ ...novemberReport, ...yearPeriod(2026) },
				yearPeriod(2026),
			);

			expect(await screen.findByRole("radio", { name: "Year" })).toBeChecked();
			expect(screen.getByText("2026")).toBeVisible();
			await user.click(screen.getByRole("button", { name: "Next period" }));
			expect(onPeriodChange).toHaveBeenLastCalledWith(yearPeriod(2027));
			await user.click(screen.getByRole("radio", { name: "Month" }));
			expect(onPeriodChange).toHaveBeenLastCalledWith(monthPeriod(2026, 1));
		});

		it("takes other dates, once the first comes before the last", async () => {
			const { user, onPeriodChange } = setUp();

			await user.click(
				await screen.findByRole("radio", { name: "Other dates" }),
			);
			expect(screen.getByLabelText("From")).toHaveValue("2026-11-01");
			fireEvent.change(screen.getByLabelText("From"), {
				target: { value: "2026-11-20" },
			});
			fireEvent.change(screen.getByLabelText("To"), {
				target: { value: "2026-11-03" },
			});
			await user.click(screen.getByRole("button", { name: "Show" }));

			expect(
				screen.getByText("Choose a first day that comes before the last."),
			).toBeVisible();
			expect(onPeriodChange).not.toHaveBeenCalled();

			fireEvent.change(screen.getByLabelText("To"), {
				target: { value: "2026-12-05" },
			});
			await user.click(screen.getByRole("button", { name: "Show" }));
			expect(onPeriodChange).toHaveBeenCalledWith({
				from: "2026-11-20",
				to: "2026-12-05",
			});
		});

		it("shows other dates as such, with their first and last days", async () => {
			const days = { from: "2026-11-03", to: "2026-11-20" };
			setUp({ ...novemberReport, ...days }, days);

			expect(
				await screen.findByRole("radio", { name: "Other dates" }),
			).toBeChecked();
			expect(screen.getByLabelText("From")).toHaveValue("2026-11-03");
			expect(screen.getByLabelText("To")).toHaveValue("2026-11-20");
		});
	});

	describe("over twelve months", () => {
		const trend = () => section("Over twelve months");
		/** A month's line in the table of figures: month, expenses, income. */
		const figures = async (month: string) => {
			const table = (await trend()).getByRole("table");
			const line = within(table)
				.getByRole("rowheader", { name: month })
				.closest("tr");
			return within(line as HTMLElement)
				.getAllByRole("cell")
				.map((cell) => cell.textContent);
		};

		it("asks for the twelve months ending with the period", async () => {
			const urls: URL[] = [];
			mockApi((request, url) => {
				urls.push(url);
				return request.path.endsWith("/reports/monthly")
					? { status: 200, body: months }
					: request.path.endsWith("/reports/tags")
						? { status: 200, body: novemberReport }
						: page(tags, { pageSize: 500 });
			});
			renderWithRouter(
				<ReportsPage
					household={household}
					period={november}
					onPeriodChange={vi.fn()}
				/>,
			);

			await trend();
			expect(
				urls.find((url) => url.pathname.endsWith("/reports/monthly"))?.search,
			).toBe("?from=2025-12-01&to=2026-11-30");
		});

		it("charts the expenses and the income of each month, with their figures", async () => {
			setUp();

			const region = await trend();

			expect(
				region.getByRole("figure", { name: "Expenses per month" }),
			).toBeVisible();
			expect(
				region.getByRole("figure", { name: "Income per month" }),
			).toBeVisible();
			expect(region.getAllByRole("row")).toHaveLength(13);
			expect(await figures("October 2026")).toEqual(["$200.00", "$0.00"]);
		});

		it("counts a month as the report counts the period: refunds lower their tag", async () => {
			setUp();

			// 370.00 + 120.00 + 50.00 + 15.00, as in the summary above
			expect(await figures("November 2026")).toEqual(["$555.00", "$2,600.00"]);
		});

		it("keeps to a tag and the tags under it once one is chosen", async () => {
			const { user } = setUp();

			await user.selectOptions((await trend()).getByLabelText("Tag"), "Food");

			expect(await figures("November 2026")).toEqual(["$490.00", "$0.00"]);
			expect(await figures("October 2026")).toEqual(["$0.00", "$0.00"]);
			// No income on this tag: no chart for it
			expect(
				(await trend()).queryByRole("figure", { name: "Income per month" }),
			).not.toBeInTheDocument();
		});

		it("says when the twelve months have nothing", async () => {
			setUp(novemberReport, november, {
				months: months.months.map((month) => ({
					...month,
					expense: 0,
					income: 0,
					tags: [],
				})),
			});

			expect(
				(await trend()).getByText("Nothing over these twelve months."),
			).toBeVisible();
		});
	});
});
