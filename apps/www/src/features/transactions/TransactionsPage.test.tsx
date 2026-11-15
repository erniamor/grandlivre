import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TransactionsPage } from "@/features/transactions/TransactionsPage";
import {
	base,
	chequing,
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
	accountId?: string;
	page?: number;
}

function setUp({ respond = respondWith(), accountId, page = 1 }: Setup = {}) {
	const urls: URL[] = [];
	mockApi((request, url) => {
		urls.push(url);
		return respond(request);
	});
	const onAccountChange = vi.fn();
	renderWithRouter(
		<TransactionsPage
			household={household}
			accountId={accountId}
			page={page}
			onAccountChange={onAccountChange}
		/>,
	);
	return {
		user: userEvent.setup(),
		onAccountChange,
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

	it("says when there is no transaction yet", async () => {
		setUp({ respond: respondWith([]) });

		expect(await screen.findByText("No transaction yet.")).toBeVisible();
	});

	describe("filtered on an account", () => {
		it("asks for the transactions of that account, and says when it has none", async () => {
			const { transactionsQuery } = setUp({
				respond: respondWith([]),
				accountId: savings.id,
			});

			expect(
				await screen.findByText("No transaction on this account."),
			).toBeVisible();
			expect(screen.getByLabelText("Account")).toHaveValue(savings.id);
			expect(transactionsQuery()).toBe(
				`?accountId=${savings.id}&page=1&pageSize=50`,
			);
		});

		it("shows a transfer as money entering the account, or leaving it", async () => {
			setUp({ respond: respondWith([toSavings]), accountId: savings.id });

			expect(await screen.findByText("+$300.00")).toBeVisible();
		});

		it("shows the same transfer as money leaving the other account", async () => {
			setUp({ respond: respondWith([toSavings]), accountId: chequing.id });

			expect(await screen.findByText("-$300.00")).toBeVisible();
		});
	});

	it("offers the accounts whose transactions the user may see, and reports the one chosen", async () => {
		const { user, onAccountChange } = setUp({ accountId: chequing.id });

		const filter = await screen.findByLabelText("Account");
		expect(
			within(filter)
				.getAllByRole("option")
				.map((option) => option.textContent),
		).toEqual(["All accounts", "Everyday", "Savings"]);

		await user.selectOptions(filter, "Savings");
		expect(onAccountChange).toHaveBeenLastCalledWith(savings.id);
		await user.selectOptions(filter, "All accounts");
		expect(onAccountChange).toHaveBeenLastCalledWith(undefined);
	});

	it("asks for the page shown, and links to the pages around it, keeping the account", async () => {
		const { transactionsQuery } = setUp({
			respond: respondWith(undefined, { page: 2, pageSize: 50, total: 120 }),
			accountId: chequing.id,
			page: 2,
		});

		const pages = within(
			await screen.findByRole("navigation", { name: "Pages" }),
		);

		expect(pages.getByText("Page 2 of 3")).toBeVisible();
		expect(pages.getByRole("link", { name: "Previous" })).toHaveAttribute(
			"href",
			`/transactions?account=${chequing.id}&page=1`,
		);
		expect(pages.getByRole("link", { name: "Next" })).toHaveAttribute(
			"href",
			`/transactions?account=${chequing.id}&page=3`,
		);
		expect(transactionsQuery()).toBe(
			`?accountId=${chequing.id}&page=2&pageSize=50`,
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
