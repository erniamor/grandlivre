import type { Tag, TagReport } from "@repo/schemas";
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
		{ tagId: groceries.id, expense: 40_000, income: 3000 },
		{ tagId: restaurant.id, expense: 12_000, income: 0 },
		{ tagId: car.id, expense: 5000, income: 0 },
		{ tagId: salary.id, expense: 0, income: 250_000 },
		{ tagId: null, expense: 1500, income: 10_000 },
	],
};

function setUp(report: TagReport = novemberReport, period: Period = november) {
	const urls: URL[] = [];
	mockApi((request, url) => {
		urls.push(url);
		if (request.path === `${base}/reports/tags`) {
			return { status: 200, body: report };
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
			expect(screen.getByText(month)).toBeVisible();
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

	it("says when a section has nothing", async () => {
		setUp({
			...novemberReport,
			tags: [{ tagId: car.id, expense: 5000, income: 0 }],
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
});
