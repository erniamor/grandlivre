import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TransactionsPage } from "@/features/transactions/TransactionsPage";
import type { TransactionListFilters } from "@/features/transactions/transaction-filters";
import {
	base,
	chequing,
	fillUp,
	food,
	household,
	respondWith,
	savings,
	toSavings,
} from "@/features/transactions/transaction-test-data";
import { setTestLocale } from "@/test/locale";
import { mockApi } from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

interface Setup {
	respond?: ReturnType<typeof respondWith>;
	filters?: TransactionListFilters;
	page?: number;
}

function setUp({
	respond = respondWith(),
	filters = {},
	page = 1,
}: Setup = {}) {
	const urls: URL[] = [];
	mockApi((request, url) => {
		urls.push(url);
		return respond(request);
	});
	const onFiltersChange = vi.fn();
	renderWithRouter(
		<TransactionsPage
			household={household}
			filters={filters}
			page={page}
			onFiltersChange={onFiltersChange}
		/>,
	);
	return {
		user: userEvent.setup(),
		onFiltersChange,
		/** The query string of the request for the transactions. */
		transactionsQuery: () =>
			urls.find((url) => url.pathname.endsWith(`${base}/transactions`))?.search,
	};
}

const day = (name: string) => screen.findByRole("region", { name });

describe("TransactionsPage", () => {
	it.each([
		["en", "Transactions", "Saturday, November 14, 2026", "-$72.00"],
		["fr", "Transactions", "samedi 14 novembre 2026", "-72,00 $"],
		["es", "Transacciones", "sábado, 14 de noviembre de 2026", "-72,00 $"],
	] as const)(
		"lists the transactions under their day, in %s",
		async (locale, title, dayName, amount) => {
			setTestLocale(locale);
			setUp();

			expect(
				await screen.findByRole("heading", { level: 1, name: title }),
			).toBeVisible();
			const saturday = within(await day(dayName));
			expect(saturday.getByText("Shell")).toBeVisible();
			expect(saturday.getByText(amount)).toBeVisible();
			expect(saturday.getAllByRole("listitem")).toHaveLength(2);
		},
	);

	it("shows who was paid, the tag and the account of an expense, as money going out", async () => {
		setUp();

		const item = within(
			(await screen.findByText("Shell")).closest("li") as HTMLElement,
		);

		expect(item.getByText("Gas · Everyday")).toBeVisible();
		expect(item.getByText("-$72.00")).toBeVisible();
	});

	it("names each tag of a split expense once, uncategorized lines included, and shows its note", async () => {
		setUp();

		const item = within(
			(await screen.findByText("Costco")).closest("li") as HTMLElement,
		);

		expect(
			item.getByText("Food · Gas · Uncategorized · Everyday"),
		).toBeVisible();
		expect(item.getByText("Monthly run")).toBeVisible();
		expect(item.getByText("-$180.00")).toBeVisible();
	});

	it("shows an income as money coming in", async () => {
		setUp();

		const item = within(
			(await screen.findByText("Employer")).closest("li") as HTMLElement,
		);

		expect(item.getByText("+$2,500.00")).toBeVisible();
	});

	it("shows a transfer with its two accounts, and no sign: the household's money doesn't move", async () => {
		setUp();

		const item = within(
			(await screen.findByText("Transfer")).closest("li") as HTMLElement,
		);

		expect(item.getByText("Everyday → Savings")).toBeVisible();
		expect(item.getByText("$300.00")).toBeVisible();
	});

	it("names a transaction without a payee after its type", async () => {
		setUp();

		const october = within(await day("Saturday, October 31, 2026"));

		expect(october.getByText("Expense")).toBeVisible();
		expect(october.getByText("Uncategorized · Everyday")).toBeVisible();
	});

	it("names an adjustment, which has no payee", async () => {
		setUp({
			respond: respondWith([{ ...fillUp, payee: null, origin: "adjustment" }]),
		});

		expect(await screen.findByText("Adjustment")).toBeVisible();
	});

	it("says when there is no transaction yet", async () => {
		setUp({ respond: respondWith([]) });

		expect(await screen.findByText("No transaction yet.")).toBeVisible();
	});

	it("leaves the quick entry to the navigation's +", async () => {
		setUp();

		expect(
			await screen.findByRole("heading", { level: 1, name: "Transactions" }),
		).toBeVisible();
		expect(
			screen.queryByRole("region", { name: "Quick entry" }),
		).not.toBeInTheDocument();
	});

	describe("filtered on an account", () => {
		it("asks for the transactions of that account, and says when none matches", async () => {
			const { transactionsQuery } = setUp({
				respond: respondWith([]),
				filters: { accountId: savings.id },
			});

			expect(
				await screen.findByText("No transaction matches these filters."),
			).toBeVisible();
			expect(screen.getByLabelText("Account")).toHaveValue(savings.id);
			expect(transactionsQuery()).toBe(
				`?accountId=${savings.id}&page=1&pageSize=50`,
			);
		});

		it("shows a transfer as money entering the account, or leaving it", async () => {
			setUp({
				respond: respondWith([toSavings]),
				filters: { accountId: savings.id },
			});

			expect(await screen.findByText("+$300.00")).toBeVisible();
		});

		it("shows the same transfer as money leaving the other account", async () => {
			setUp({
				respond: respondWith([toSavings]),
				filters: { accountId: chequing.id },
			});

			expect(await screen.findByText("-$300.00")).toBeVisible();
		});
	});

	describe("the filters", () => {
		it("offer the accounts whose transactions the user may see, and the tags", async () => {
			setUp();

			const account = await screen.findByLabelText("Account");
			expect(
				within(account)
					.getAllByRole("option")
					.map((option) => option.textContent),
			).toEqual(["All accounts", "Everyday", "Savings"]);
			expect(
				within(screen.getByLabelText("Tag"))
					.getAllByRole("option")
					.map((option) => option.textContent),
			).toEqual(["All tags", "Food", "Gas"]);
		});

		it("apply each choice at once, keeping the others", async () => {
			const { user, onFiltersChange } = setUp({
				filters: { accountId: chequing.id },
			});

			await user.selectOptions(await screen.findByLabelText("Tag"), "Food");
			expect(onFiltersChange).toHaveBeenLastCalledWith({
				accountId: chequing.id,
				tagId: food.id,
			});
			fireEvent.change(screen.getByLabelText("From"), {
				target: { value: "2026-11-01" },
			});
			expect(onFiltersChange).toHaveBeenLastCalledWith({
				accountId: chequing.id,
				from: "2026-11-01",
			});
			await user.selectOptions(
				screen.getByLabelText("Account"),
				"All accounts",
			);
			expect(onFiltersChange).toHaveBeenLastCalledWith({
				accountId: undefined,
			});
		});

		it("ask for the transactions of a tag over a period", async () => {
			const { transactionsQuery } = setUp({
				filters: { tagId: food.id, from: "2026-11-01", to: "2026-11-30" },
			});

			await screen.findByText("Shell");
			expect(screen.getByLabelText("Tag")).toHaveValue(food.id);
			expect(screen.getByLabelText("From")).toHaveValue("2026-11-01");
			expect(screen.getByLabelText("To")).toHaveValue("2026-11-30");
			expect(transactionsQuery()).toBe(
				`?tagId=${food.id}&from=2026-11-01&to=2026-11-30&page=1&pageSize=50`,
			);
		});

		it("refuse a period that ends before it starts", async () => {
			const { onFiltersChange } = setUp({ filters: { from: "2026-11-20" } });

			fireEvent.change(await screen.findByLabelText("To"), {
				target: { value: "2026-11-03" },
			});

			expect(
				screen.getByText("Choose a first day that comes before the last."),
			).toBeVisible();
			expect(onFiltersChange).not.toHaveBeenCalled();
		});

		it("search once typing pauses, the words trimmed", async () => {
			const { user, onFiltersChange } = setUp({
				filters: { accountId: chequing.id },
			});

			await user.type(await screen.findByLabelText("Search"), " café ");

			await waitFor(() =>
				expect(onFiltersChange).toHaveBeenCalledWith({
					accountId: chequing.id,
					q: "café",
				}),
			);
			expect(onFiltersChange).toHaveBeenCalledTimes(1);
		});

		it("ask for the words searched, a type and an amount range", async () => {
			const { transactionsQuery } = setUp({
				filters: {
					q: "shell",
					type: "expense",
					minAmount: 2_500,
					maxAmount: 50_000,
				},
			});

			await screen.findByText("Shell");
			expect(screen.getByLabelText("Search")).toHaveValue("shell");
			expect(screen.getByRole("button", { name: "Expenses" })).toHaveAttribute(
				"aria-pressed",
				"true",
			);
			expect(screen.getByText("$25 to $500")).toBeVisible();
			expect(
				screen.getByRole("slider", { name: "Maximum amount" }),
			).toHaveAttribute("aria-valuetext", "$500");
			expect(transactionsQuery()).toBe(
				"?q=shell&type=expense&minAmount=2500&maxAmount=50000&page=1&pageSize=50",
			);
		});

		it("narrow on a type, or all of them", async () => {
			const { user, onFiltersChange } = setUp({ filters: { type: "income" } });

			await user.click(
				await screen.findByRole("button", { name: "Transfers" }),
			);
			expect(onFiltersChange).toHaveBeenLastCalledWith({ type: "transfer" });
			await user.click(screen.getByRole("button", { name: "All" }));
			expect(onFiltersChange).toHaveBeenLastCalledWith({ type: undefined });
		});

		it("narrow on an amount range, moved by the keyboard from stop to stop", async () => {
			const { user, onFiltersChange } = setUp();

			const minimum = await screen.findByRole("slider", {
				name: "Minimum amount",
			});
			expect(screen.getByText("Any amount")).toBeVisible();
			minimum.focus();
			await user.keyboard("{ArrowRight}");
			expect(onFiltersChange).toHaveBeenLastCalledWith({
				minAmount: 1_000,
				maxAmount: undefined,
			});
			expect(screen.getByText("$10 and more")).toBeVisible();
			const maximum = screen.getByRole("slider", { name: "Maximum amount" });
			expect(maximum).toHaveAttribute("aria-valuetext", "No maximum");
			// The thumbs stay where they were moved while the list follows
			maximum.focus();
			await user.keyboard("{ArrowLeft}");
			expect(onFiltersChange).toHaveBeenLastCalledWith({
				minAmount: 1_000,
				maxAmount: 500_000,
			});
		});

		it("are cleared in one go, once there is one", async () => {
			const { user, onFiltersChange } = setUp({ filters: { tagId: food.id } });

			await user.click(
				await screen.findByRole("button", { name: "Clear the filters" }),
			);

			expect(onFiltersChange).toHaveBeenLastCalledWith({});
		});

		it("offer nothing to clear without a filter", async () => {
			setUp();

			await screen.findByText("Shell");
			expect(
				screen.queryByRole("button", { name: "Clear the filters" }),
			).not.toBeInTheDocument();
		});
	});

	it("asks for the page shown, and links to the pages around it, keeping the filters", async () => {
		const { transactionsQuery } = setUp({
			respond: respondWith(undefined, { page: 2, pageSize: 50, total: 120 }),
			filters: { accountId: chequing.id, tagId: food.id },
			page: 2,
		});

		const pages = within(
			await screen.findByRole("navigation", { name: "Pages" }),
		);

		expect(pages.getByText("Page 2 of 3")).toBeVisible();
		expect(pages.getByRole("link", { name: "Previous" })).toHaveAttribute(
			"href",
			`/transactions?account=${chequing.id}&tag=${food.id}&page=1`,
		);
		expect(pages.getByRole("link", { name: "Next" })).toHaveAttribute(
			"href",
			`/transactions?account=${chequing.id}&tag=${food.id}&page=3`,
		);
		expect(transactionsQuery()).toBe(
			`?accountId=${chequing.id}&tagId=${food.id}&page=2&pageSize=50`,
		);
	});

	it("says the transactions of the accounts whose balance only the user sees aren't listed", async () => {
		setUp();

		expect(
			await screen.findByText(
				/^The transactions of the accounts whose balance only you see/,
			),
		).toBeVisible();
	});

	it("offers to add a transaction, on the account the list is filtered on", async () => {
		setUp({ filters: { accountId: savings.id } });

		expect(
			await screen.findByRole("link", { name: "Add a transaction" }),
		).toHaveAttribute("href", `/transactions/new?account=${savings.id}`);
	});

	it("links each transaction to its page", async () => {
		setUp();

		expect(await screen.findByRole("link", { name: "Shell" })).toHaveAttribute(
			"href",
			`/transactions/${fillUp.id}`,
		);
		expect(screen.getByRole("link", { name: "Transfer" })).toHaveAttribute(
			"href",
			`/transactions/${toSavings.id}`,
		);
	});

	it("shows no page links when everything fits in one page", async () => {
		setUp();

		await screen.findByText("Shell");
		expect(
			screen.queryByRole("navigation", { name: "Pages" }),
		).not.toBeInTheDocument();
	});
});

describe("TransactionsPage, sorting by payee", () => {
	it("leads to sorting the payees left without a tag, while there are some", async () => {
		const reads = respondWith();
		setUp({
			respond: (request) =>
				request.path === `${base}/transactions/uncategorized`
					? {
							status: 200,
							body: {
								data: [],
								pagination: { page: 1, pageSize: 200, total: 12 },
							},
						}
					: reads(request),
		});

		expect(
			await screen.findByRole("link", { name: "Sort by payee (12)" }),
		).toHaveAttribute("href", "/categorize");
	});

	it("shows nothing once every payee has a tag", async () => {
		setUp();

		await day("Saturday, November 14, 2026");
		expect(
			screen.queryByRole("link", { name: /^Sort by payee/ }),
		).not.toBeInTheDocument();
	});
});
