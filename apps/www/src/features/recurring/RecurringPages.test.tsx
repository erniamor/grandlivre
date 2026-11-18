import type { RecurringSuggestion, RecurringTransaction } from "@repo/schemas";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditRecurringPage } from "@/features/recurring/EditRecurringPage";
import { NewRecurringPage } from "@/features/recurring/NewRecurringPage";
import { RecurringPage } from "@/features/recurring/RecurringPage";
import {
	base,
	bobsCard,
	chequing,
	fillUp,
	gas,
	household,
	page,
	respondWith,
	savings,
} from "@/features/transactions/transaction-test-data";
import { chooseTag } from "@/test/choose-tag";
import { setTestLocale } from "@/test/locale";
import { type ApiRequest, type ApiResponse, mockApi } from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

beforeEach(() => {
	// Only the clock: November 15th, 2026 in Montreal
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2026-11-15T17:00:00Z"));
});

afterEach(() => {
	vi.useRealTimers();
});

const NOW = "2026-11-15T12:00:00.000Z";
const RENT_ID = "00000000-0000-4000-8000-000000000051";
const PAY_ID = "00000000-0000-4000-8000-000000000052";

const rent: RecurringTransaction = {
	id: RENT_ID,
	householdId: household.id,
	transaction: {
		type: "expense",
		accountId: chequing.id,
		toAccountId: null,
		amount: 150_000,
		payee: "Landlord",
		note: null,
		lines: [{ amount: 150_000, tagId: gas.id }],
	},
	schedule: {
		unit: "month",
		interval: 1,
		startDate: "2026-12-01",
		endDate: null,
	},
	mode: "automatic",
	nextDate: "2026-12-01",
	createdBy: null,
	createdAt: NOW,
	updatedAt: NOW,
};

const saving: RecurringTransaction = {
	...rent,
	id: PAY_ID,
	transaction: {
		...rent.transaction,
		type: "transfer",
		toAccountId: savings.id,
		amount: 20_000,
		payee: null,
		lines: [],
	},
	schedule: { ...rent.schedule, unit: "week", interval: 2 },
	mode: "confirm",
	nextDate: null,
};

/** A power bill found 17 times in the history, its amount varying. */
const hydro: RecurringSuggestion = {
	accountId: chequing.id,
	toAccountId: null,
	type: "expense",
	key: "hydroquebec",
	payee: "HYDRO-QUEBEC",
	unit: "month",
	interval: 1,
	amount: 79_07,
	minAmount: 62_50,
	maxAmount: 389_31,
	mode: "confirm",
	nextDate: "2026-11-26",
	tagId: gas.id,
	count: 17,
	dates: ["2026-09-26", "2026-10-27"],
};

/**
 * Answers the reads, the recurring transactions and the suggestions given,
 * and `respond` for the rest.
 */
function api(
	recurring: RecurringTransaction[] = [rent, saving],
	respond: (request: ApiRequest) => ApiResponse | undefined = () => undefined,
	suggestions: RecurringSuggestion[] = [],
) {
	const reads = respondWith();
	return mockApi((request) => {
		if (
			request.method === "GET" &&
			request.path === `${base}/recurring-transactions/suggestions`
		) {
			return page(suggestions, { pageSize: 100 });
		}
		if (
			request.method === "GET" &&
			request.path === `${base}/recurring-transactions`
		) {
			return page(recurring, { pageSize: 100 });
		}
		const id = request.path.split("/").at(-1);
		const found = recurring.find((item) => item.id === id);
		if (request.method === "GET" && found) {
			return { status: 200, body: found };
		}
		return respond(request) ?? reads(request);
	});
}

const writes = (requests: ApiRequest[]) =>
	requests.filter((request) => request.method !== "GET");

describe("RecurringPage", () => {
	it.each([
		[
			"en",
			"Recurring",
			"Every month · Next: Tuesday, December 1, 2026 · Automatic",
			"-$1,500.00",
		],
		[
			"fr",
			"Récurrentes",
			"Tous les mois · Prochaine : mardi 1 décembre 2026 · Automatique",
			"-1 500,00 $",
		],
	] as const)(
		"lists them with how often and when next, in %s",
		async (locale, title, when, amount) => {
			setTestLocale(locale);
			api();
			renderWithRouter(<RecurringPage household={household} />);

			expect(
				await screen.findByRole("heading", { level: 1, name: title }),
			).toBeVisible();
			const item = within(
				(await screen.findByText("Landlord")).closest("li") as HTMLElement,
			);
			expect(item.getByText(when)).toBeVisible();
			expect(item.getByText(amount)).toBeVisible();
		},
	);

	it("shows a transfer between its accounts, and one that has ended", async () => {
		api();
		renderWithRouter(<RecurringPage household={household} />);

		const item = within(
			(await screen.findByText("Everyday → Savings")).closest(
				"li",
			) as HTMLElement,
		);
		expect(item.getByText("Every 2 weeks · Ended · To confirm")).toBeVisible();
		expect(item.getByText("$200.00")).toBeVisible();
	});

	it("links each to its page, and offers to add one", async () => {
		api();
		renderWithRouter(<RecurringPage household={household} />);

		expect(
			await screen.findByRole("link", { name: "Landlord" }),
		).toHaveAttribute("href", `/recurring/${RENT_ID}`);
		expect(
			screen.getByRole("link", { name: "Add a recurring transaction" }),
		).toHaveAttribute("href", "/recurring/new");
	});

	it("says when there is none yet", async () => {
		api([]);
		renderWithRouter(<RecurringPage household={household} />);

		expect(
			await screen.findByText("No recurring transaction yet."),
		).toBeVisible();
	});
});

describe("RecurringPage, suggestions", () => {
	it("shows the series found in the history, to make recurring", async () => {
		api([rent], undefined, [hydro]);
		renderWithRouter(<RecurringPage household={household} />);

		expect(
			await screen.findByRole("heading", { name: "Found in your history" }),
		).toBeVisible();
		const item = within(
			screen.getByText("HYDRO-QUEBEC").closest("li") as HTMLElement,
		);
		expect(
			item.getByText("Every month · Next: Thursday, November 26, 2026"),
		).toBeVisible();
		expect(
			item.getByText("Seen 17 times, last on Tuesday, October 27, 2026"),
		).toBeVisible();
		expect(item.getByText("-$79.07")).toBeVisible();
		expect(item.getByText("from $62.50 to $389.31")).toBeVisible();
		expect(
			item.getByRole("link", { name: "Make “HYDRO-QUEBEC” recurring" }),
		).toHaveAttribute(
			"href",
			`/recurring/new?suggestion=${chequing.id}..expense.hydroquebec.month.1.2026-11-26`,
		);
	});

	it("dismisses one the user says doesn't recur", async () => {
		const requests = api(
			[rent],
			(request) =>
				request.method === "POST" ? { status: 204, body: null } : undefined,
			[hydro],
		);
		const user = userEvent.setup();
		renderWithRouter(<RecurringPage household={household} />);

		await user.click(
			await screen.findByRole("button", {
				name: "“HYDRO-QUEBEC” is not recurring",
			}),
		);

		await vi.waitFor(() =>
			expect(writes(requests)).toEqual([
				{
					method: "POST",
					path: `${base}/recurring-transactions/suggestions/dismiss`,
					body: {
						accountId: chequing.id,
						toAccountId: null,
						type: "expense",
						key: "hydroquebec",
						unit: "month",
						interval: 1,
						startDate: "2026-11-26",
					},
				},
			]),
		);
	});

	it("shows no section when nothing was found", async () => {
		api([rent]);
		renderWithRouter(<RecurringPage household={household} />);

		await screen.findByText("Landlord");
		expect(
			screen.queryByRole("heading", { name: "Found in your history" }),
		).not.toBeInTheDocument();
	});
});

describe("NewRecurringPage, from a suggestion", () => {
	it("starts from it: its amount, tag, cadence, next date and mode", async () => {
		const requests = api([], (request) =>
			request.method === "POST" ? { status: 201, body: rent } : undefined,
		);
		const onCreated = vi.fn();
		const user = userEvent.setup();
		renderWithRouter(
			<NewRecurringPage
				household={household}
				suggestion={hydro}
				onCreated={onCreated}
			/>,
		);

		expect(
			await screen.findByText(
				"Found 17 times in your history: check the amount, how often it comes back, and from when.",
			),
		).toBeVisible();
		expect(screen.getByLabelText("Amount")).toHaveValue("79.07");
		expect(screen.getByLabelText("Paid to (optional)")).toHaveValue(
			"HYDRO-QUEBEC",
		);
		expect(screen.getByLabelText("First date")).toHaveValue("2026-11-26");
		expect(screen.getByRole("radio", { name: /^To confirm/ })).toBeChecked();
		await user.click(
			screen.getByRole("button", { name: "Create the recurring transaction" }),
		);

		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(writes(requests)).toMatchObject([
			{
				body: {
					transaction: {
						type: "expense",
						accountId: chequing.id,
						payee: "HYDRO-QUEBEC",
						lines: [{ amount: 79_07, tagId: gas.id }],
					},
					schedule: { unit: "month", interval: 1, startDate: "2026-11-26" },
					mode: "confirm",
				},
			},
		]);
	});
});

describe("NewRecurringPage", () => {
	function setUp(respond?: (request: ApiRequest) => ApiResponse | undefined) {
		const requests = api(
			[],
			respond ??
				((request) =>
					request.method === "POST" ? { status: 201, body: rent } : undefined),
		);
		const onCreated = vi.fn();
		renderWithRouter(
			<NewRecurringPage household={household} onCreated={onCreated} />,
		);
		return { requests, onCreated, user: userEvent.setup() };
	}

	it("creates a recurring expense, monthly and to confirm unless told otherwise", async () => {
		const { requests, onCreated, user } = setUp();

		await user.type(await screen.findByLabelText("Amount"), "1500");
		await chooseTag(user, screen.getByLabelText("Tag"), "Gas");
		await user.type(screen.getByLabelText("Paid to (optional)"), "Landlord");
		fireEvent.change(screen.getByLabelText("First date"), {
			target: { value: "2026-12-01" },
		});
		await user.click(screen.getByRole("radio", { name: /^Automatic/ }));
		await user.click(
			screen.getByRole("button", { name: "Create the recurring transaction" }),
		);

		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(writes(requests)).toEqual([
			{
				method: "POST",
				path: `${base}/recurring-transactions`,
				body: {
					transaction: {
						type: "expense",
						accountId: chequing.id,
						note: null,
						payee: "Landlord",
						lines: [{ amount: 150_000, tagId: gas.id }],
					},
					schedule: {
						unit: "month",
						interval: 1,
						startDate: "2026-12-01",
						endDate: null,
					},
					mode: "automatic",
				},
			},
		]);
	});

	it("offers to confirm each time first, its default", async () => {
		setUp();

		const modes = await screen.findAllByRole("radio", {
			name: /^(To confirm|Automatic)/,
		});
		expect(modes.map((radio) => radio.getAttribute("value"))).toEqual([
			"confirm",
			"automatic",
		]);
		expect(modes[0]).toBeChecked();
	});

	it("starts today, and refuses a first date already past", async () => {
		const { requests, user } = setUp();

		const first = await screen.findByLabelText("First date");
		expect(first).toHaveValue("2026-11-15");
		expect(screen.getByLabelText("Every")).toHaveValue("1");
		await user.type(screen.getByLabelText("Amount"), "10");
		fireEvent.change(first, { target: { value: "2026-11-01" } });
		await user.click(
			screen.getByRole("button", { name: "Create the recurring transaction" }),
		);

		expect(
			await screen.findByText(
				"Choose today or a later day. What already happened is entered as transactions.",
			),
		).toBeVisible();
		expect(writes(requests)).toEqual([]);
	});

	it("shows the API's errors next to their fields", async () => {
		const { user } = setUp((request) =>
			request.method !== "POST"
				? undefined
				: {
						status: 422,
						body: {
							error: {
								code: "validation_error",
								message: "Invalid",
								details: [
									{
										field: "transaction.lines.0.tagId",
										message: "transaction_tag_invalid",
									},
									{
										field: "schedule.interval",
										message: "recurrence_interval_invalid",
									},
								],
							},
						},
					},
		);

		await user.type(await screen.findByLabelText("Amount"), "10");
		await user.click(
			screen.getByRole("button", { name: "Create the recurring transaction" }),
		);

		expect(
			await screen.findByText("Enter a whole number from 1 to 99."),
		).toBeVisible();
	});
});

describe("NewRecurringPage, from a transaction", () => {
	it("starts from it: what it records, monthly, from a month later", async () => {
		const requests = api([], (request) =>
			request.method === "POST" ? { status: 201, body: rent } : undefined,
		);
		const onCreated = vi.fn();
		const user = userEvent.setup();
		renderWithRouter(
			<NewRecurringPage
				household={household}
				from={fillUp}
				onCreated={onCreated}
			/>,
		);

		expect(
			await screen.findByText(
				"Made from a transaction: check how often it comes back, and from when.",
			),
		).toBeVisible();
		expect(screen.getByLabelText("Amount")).toHaveValue("72.00");
		expect(screen.getByLabelText("Paid to (optional)")).toHaveValue("Shell");
		expect(screen.getByLabelText("First date")).toHaveValue("2026-12-14");
		await user.click(
			screen.getByRole("button", { name: "Create the recurring transaction" }),
		);

		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(writes(requests)).toMatchObject([
			{
				body: {
					transaction: {
						type: "expense",
						accountId: fillUp.accountId,
						payee: "Shell",
						lines: [{ amount: 7_200, tagId: gas.id }],
					},
					schedule: { unit: "month", interval: 1, startDate: "2026-12-14" },
				},
			},
		]);
	});
});

describe("EditRecurringPage", () => {
	function setUp(
		recurring: RecurringTransaction,
		respond?: (request: ApiRequest) => ApiResponse | undefined,
	) {
		const requests = api([recurring], respond);
		const onDone = vi.fn();
		renderWithRouter(
			<EditRecurringPage
				household={household}
				recurringId={recurring.id}
				onDone={onDone}
			/>,
		);
		return { requests, onDone, user: userEvent.setup() };
	}

	it("changes what it records, its schedule kept as it was", async () => {
		const { requests, onDone, user } = setUp(rent, (request) =>
			request.method === "PUT" ? { status: 200, body: rent } : undefined,
		);

		const amount = await screen.findByLabelText("Amount");
		expect(amount).toHaveValue("1500.00");
		expect(screen.getByLabelText("First date")).toHaveValue("2026-12-01");
		await user.clear(amount);
		await user.type(amount, "1550");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
		expect(writes(requests)).toMatchObject([
			{
				method: "PUT",
				path: `${base}/recurring-transactions/${RENT_ID}`,
				body: {
					transaction: { lines: [{ amount: 155_000, tagId: gas.id }] },
					schedule: rent.schedule,
					mode: "automatic",
				},
			},
		]);
	});

	it("deletes it after a confirmation", async () => {
		const { requests, onDone, user } = setUp(rent, (request) =>
			request.method === "DELETE" ? { status: 204 } : undefined,
		);

		await user.click(
			await screen.findByRole("button", {
				name: "Delete the recurring transaction",
			}),
		);
		await user.click(screen.getByRole("button", { name: "Delete" }));

		await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
		expect(writes(requests)).toEqual([
			{
				method: "DELETE",
				path: `${base}/recurring-transactions/${RENT_ID}`,
				body: undefined,
			},
		]);
	});

	it("only shows it to a member who doesn't hold its account", async () => {
		setUp({
			...rent,
			transaction: { ...rent.transaction, accountId: bobsCard.id },
		});

		expect(
			await screen.findByText("Only the holders of its account can change it."),
		).toBeVisible();
		expect(
			screen.queryByRole("button", { name: "Save" }),
		).not.toBeInTheDocument();
	});
});
