import type { Transaction } from "@repo/schemas";
import { toast } from "@repo/ui";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditTransactionPage } from "@/features/transactions/EditTransactionPage";
import { NewTransactionPage } from "@/features/transactions/NewTransactionPage";
import {
	accounts,
	base,
	bobsCard,
	chequing,
	fillUp,
	food,
	gas,
	groceries,
	household,
	page,
	respondWith,
	savings,
	toSavings,
} from "@/features/transactions/transaction-test-data";
import { localToday } from "@/features/transactions/use-local-today";
import { chooseTag } from "@/test/choose-tag";
import { setTestLocale } from "@/test/locale";
import { type ApiRequest, type ApiResponse, mockApi } from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

afterEach(() => {
	vi.restoreAllMocks();
	window.localStorage.clear();
});

type Respond = (request: ApiRequest) => ApiResponse | undefined;

const reads = respondWith();

function mockTransactions(
	respond: Respond = () => ({ status: 201, body: fillUp }),
	transaction?: Transaction,
	accountItems = accounts,
) {
	const requests = mockApi((request) => {
		if (request.method !== "GET") {
			return respond(request);
		}
		if (
			transaction &&
			request.path === `${base}/transactions/${transaction.id}`
		) {
			return { status: 200, body: transaction };
		}
		if (request.path === `${base}/accounts`) {
			return page(accountItems, { pageSize: 100 });
		}
		return reads(request);
	});
	/** The requests that change something, without the reads. */
	return () => requests.filter((request) => request.method !== "GET");
}

function renderNew(
	options: {
		respond?: Respond;
		accountId?: string;
		accounts?: typeof accounts;
	} = {},
) {
	const writes = mockTransactions(options.respond, undefined, options.accounts);
	const onCreated = vi.fn();
	renderWithRouter(
		<NewTransactionPage
			household={household}
			accountId={options.accountId}
			onCreated={onCreated}
		/>,
	);
	return { user: userEvent.setup(), onCreated, writes };
}

function renderEdit(transaction: Transaction, respond?: Respond) {
	const writes = mockTransactions(
		respond ?? (() => ({ status: 200, body: transaction })),
		transaction,
	);
	const onDone = vi.fn();
	renderWithRouter(
		<EditTransactionPage
			household={household}
			transactionId={transaction.id}
			onDone={onDone}
		/>,
	);
	return { user: userEvent.setup(), onDone, writes };
}

const submit = (name = "Record the transaction") =>
	screen.getByRole("button", { name });

const optionLabels = (select: HTMLElement) =>
	within(select)
		.getAllByRole("option")
		.map((option) => option.textContent);

describe("NewTransactionPage", () => {
	it.each([
		["en", "New transaction", "Amount", "Expense"],
		["fr", "Nouvelle transaction", "Montant", "Dépense"],
		["es", "Nueva transacción", "Importe", "Gasto"],
	] as const)(
		"shows the form for an expense, in %s",
		async (locale, title, amountLabel, expenseLabel) => {
			setTestLocale(locale);
			renderNew();

			expect(
				await screen.findByRole("heading", { level: 1, name: title }),
			).toBeVisible();
			expect(screen.getByLabelText(amountLabel)).toBeVisible();
			expect(screen.getByRole("radio", { name: expenseLabel })).toBeChecked();
		},
	);

	it("records an expense with just an amount: today, on the user's first account, uncategorized", async () => {
		const success = vi.spyOn(toast, "success").mockImplementation(() => "");
		const { user, onCreated, writes } = renderNew();

		await user.type(await screen.findByLabelText("Amount"), "72");
		await user.click(submit());

		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(writes()).toEqual([
			{
				method: "POST",
				path: `${base}/transactions`,
				body: {
					type: "expense",
					accountId: chequing.id,
					date: localToday(),
					payee: null,
					note: null,
					lines: [{ amount: 7200, tagId: null }],
					origin: "manual",
				},
			},
		]);
		expect(success).toHaveBeenCalledWith("The transaction was recorded.");
	});

	it("records who was paid, the tag, the account, the date and a note", async () => {
		const { user, onCreated, writes } = renderNew();

		await user.type(await screen.findByLabelText("Amount"), "72.50");
		await chooseTag(user, screen.getByLabelText("Tag"), "Gas");
		await user.selectOptions(screen.getByLabelText("Account"), "Savings");
		fireEvent.change(screen.getByLabelText("Date"), {
			target: { value: "2026-11-14" },
		});
		await user.type(screen.getByLabelText("Paid to (optional)"), " Shell ");
		await user.type(screen.getByLabelText("Note (optional)"), "Full tank");
		await user.click(submit());

		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(writes()).toMatchObject([
			{
				body: {
					type: "expense",
					accountId: savings.id,
					date: "2026-11-14",
					payee: "Shell",
					note: "Full tank",
					lines: [{ amount: 7250, tagId: gas.id }],
				},
			},
		]);
	});

	it("records an income, read in the user's language", async () => {
		setTestLocale("fr");
		const { user, onCreated, writes } = renderNew();

		await user.click(await screen.findByRole("radio", { name: "Revenu" }));
		await user.type(screen.getByLabelText("Montant"), "2 500,00");
		await user.type(screen.getByLabelText("Reçu de (facultatif)"), "Employeur");
		await user.click(submit("Enregistrer la transaction"));

		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(writes()).toMatchObject([
			{
				body: {
					type: "income",
					payee: "Employeur",
					lines: [{ amount: 250_000, tagId: null }],
				},
			},
		]);
	});

	it("splits an expense into lines, each with its tag, and shows their total", async () => {
		const { user, onCreated, writes } = renderNew();

		await user.type(await screen.findByLabelText("Amount"), "120");
		await chooseTag(user, screen.getByLabelText("Tag"), "Food");
		await user.click(
			screen.getByRole("button", { name: "Split into several tags" }),
		);
		expect(screen.getByLabelText("Amount of line 1")).toHaveValue("120");
		expect(screen.getByLabelText("Tag of line 1")).toHaveAccessibleName(
			"Tag of line 1: Food",
		);
		expect(screen.getByText("Total: —")).toBeVisible();

		await user.type(screen.getByLabelText("Amount of line 2"), "45");
		await chooseTag(user, screen.getByLabelText("Tag of line 2"), "Gas");
		await user.click(screen.getByRole("button", { name: "Add a line" }));
		await user.type(screen.getByLabelText("Amount of line 3"), "15");
		expect(screen.getByText("Total: $180.00")).toBeVisible();
		await user.click(submit());

		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(writes()).toMatchObject([
			{
				body: {
					lines: [
						{ amount: 12_000, tagId: food.id },
						{ amount: 4500, tagId: gas.id },
						{ amount: 1500, tagId: null },
					],
				},
			},
		]);
	});

	it("goes back to a single amount when the other lines are removed", async () => {
		const { user } = renderNew();

		await user.type(await screen.findByLabelText("Amount"), "120");
		await user.click(
			screen.getByRole("button", { name: "Split into several tags" }),
		);
		await user.click(screen.getByRole("button", { name: "Remove line 1" }));

		expect(screen.getByLabelText("Amount")).toHaveValue("");
		expect(screen.queryByLabelText("Amount of line 1")).not.toBeInTheDocument();
	});

	it("records a transfer: an amount and two accounts, no tag nor payee", async () => {
		const { user, onCreated, writes } = renderNew();

		await user.click(await screen.findByRole("radio", { name: "Transfer" }));
		expect(screen.queryByLabelText("Tag")).not.toBeInTheDocument();
		expect(
			screen.queryByLabelText("Paid to (optional)"),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Split into several tags" }),
		).not.toBeInTheDocument();
		// Any other account of the household, even one the user doesn't hold
		expect(optionLabels(screen.getByLabelText("To the account"))).toEqual([
			"Choose an account",
			"Savings",
			"Bob's Visa",
		]);

		await user.type(screen.getByLabelText("Amount"), "300");
		await user.selectOptions(
			screen.getByLabelText("To the account"),
			"Bob's Visa",
		);
		await user.click(submit());

		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(writes()).toMatchObject([
			{
				body: {
					type: "transfer",
					accountId: chequing.id,
					toAccountId: bobsCard.id,
					amount: 30_000,
				},
			},
		]);
		expect(writes()[0]?.body).not.toHaveProperty("lines");
	});

	it("offers the accounts the user holds, and proposes the one asked for", async () => {
		renderNew({ accountId: savings.id });

		const account = await screen.findByLabelText("Account");

		expect(optionLabels(account)).toEqual(["Everyday", "Savings"]);
		expect(account).toHaveValue(savings.id);
	});

	it("proposes the account last recorded on, and remembers the one just used", async () => {
		window.localStorage.setItem("grandlivre:last-account", savings.id);
		const { user, onCreated } = renderNew({
			respond: () => ({ status: 201, body: fillUp }),
		});

		expect(await screen.findByLabelText("Account")).toHaveValue(savings.id);
		await user.type(screen.getByLabelText("Amount"), "72");
		await user.click(submit());

		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		// The account of the transaction the API answered with
		expect(window.localStorage.getItem("grandlivre:last-account")).toBe(
			chequing.id,
		);
	});

	it("doesn't propose an account the user doesn't hold", async () => {
		window.localStorage.setItem("grandlivre:last-account", bobsCard.id);
		renderNew({ accountId: bobsCard.id });

		expect(await screen.findByLabelText("Account")).toHaveValue(chequing.id);
	});

	it("says which amount is missing or isn't positive, without calling the API", async () => {
		const { user, onCreated, writes } = renderNew();

		await user.click(await screen.findByRole("button", { name: /^Record/ }));
		expect(
			await screen.findByText("Enter an amount, like 1250.50."),
		).toBeVisible();

		await user.type(screen.getByLabelText("Amount"), "0");
		await user.click(submit());
		expect(
			await screen.findByText("Enter an amount greater than zero."),
		).toBeVisible();
		expect(writes()).toEqual([]);
		expect(onCreated).not.toHaveBeenCalled();
	});

	it("asks for the destination of a transfer", async () => {
		const { user, writes } = renderNew();

		await user.click(await screen.findByRole("radio", { name: "Transfer" }));
		await user.type(screen.getByLabelText("Amount"), "300");
		await user.click(submit());

		expect(await screen.findByText("Choose an account.")).toBeVisible();
		expect(writes()).toEqual([]);
	});

	it("shows the API's errors next to their field, and the others for the form", async () => {
		const { user, onCreated } = renderNew({
			respond: () => ({
				status: 422,
				body: {
					error: {
						code: "validation_error",
						message: "Invalid request",
						details: [
							{ field: "lines.0.tagId", message: "transaction_tag_invalid" },
							{ field: "note", message: "transaction_note_too_long" },
						],
					},
				},
			}),
		});

		await user.type(await screen.findByLabelText("Amount"), "72");
		await user.click(
			screen.getByRole("button", { name: "Split into several tags" }),
		);
		await user.type(screen.getByLabelText("Amount of line 2"), "1");
		await user.click(submit());

		expect(
			await screen.findByText("This tag no longer exists. Choose another one."),
		).toBeVisible();
		expect(
			screen.getByText("This note is too long (500 characters at most)."),
		).toBeVisible();
		expect(onCreated).not.toHaveBeenCalled();
	});

	it("says when the account is archived", async () => {
		const { user } = renderNew({
			respond: () => ({
				status: 409,
				body: { error: { code: "account_archived", message: "Archived" } },
			}),
		});

		await user.type(await screen.findByLabelText("Amount"), "72");
		await user.click(submit());

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"This account is archived",
		);
	});

	it("sends a user who holds no account to add one first", async () => {
		renderNew({ accounts: [bobsCard] });

		expect(
			await screen.findByText(
				"A transaction is recorded on an account you hold. Add one first.",
			),
		).toBeVisible();
		expect(
			screen.getByRole("link", { name: "Add an account" }),
		).toHaveAttribute("href", "/accounts/new");
		expect(screen.queryByLabelText("Amount")).not.toBeInTheDocument();
	});
});

describe("EditTransactionPage", () => {
	it("shows the transaction as it is", async () => {
		renderEdit(fillUp);

		expect(await screen.findByLabelText("Amount")).toHaveValue("72.00");
		expect(screen.getByRole("radio", { name: "Expense" })).toBeChecked();
		expect(screen.getByLabelText("Tag")).toHaveAccessibleName("Tag: Gas");
		expect(screen.getByLabelText("Account")).toHaveValue(chequing.id);
		expect(screen.getByLabelText("Date")).toHaveValue("2026-11-14");
		expect(screen.getByLabelText("Paid to (optional)")).toHaveValue("Shell");
	});

	it("shows a split transaction line by line, with its total", async () => {
		renderEdit(groceries);

		expect(await screen.findByLabelText("Amount of line 1")).toHaveValue(
			"120.00",
		);
		expect(screen.getByLabelText("Tag of line 1")).toHaveAccessibleName(
			"Tag of line 1: Food",
		);
		expect(screen.getByLabelText("Tag of line 3")).toHaveAccessibleName(
			"Tag of line 3: Uncategorized",
		);
		expect(screen.getByText("Total: $180.00")).toBeVisible();
		expect(screen.getByLabelText("Note (optional)")).toHaveValue("Monthly run");
	});

	it("shows a transfer with its two accounts", async () => {
		renderEdit(toSavings);

		expect(await screen.findByLabelText("Amount")).toHaveValue("300.00");
		expect(screen.getByRole("radio", { name: "Transfer" })).toBeChecked();
		expect(screen.getByLabelText("From the account")).toHaveValue(chequing.id);
		expect(screen.getByLabelText("To the account")).toHaveValue(savings.id);
	});

	it("saves the whole transaction, then leaves", async () => {
		const success = vi.spyOn(toast, "success").mockImplementation(() => "");
		const { user, onDone, writes } = renderEdit(fillUp);

		const amount = await screen.findByLabelText("Amount");
		await user.clear(amount);
		await user.type(amount, "80");
		await user.click(submit("Save"));

		await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
		expect(writes()).toEqual([
			{
				method: "PUT",
				path: `${base}/transactions/${fillUp.id}`,
				body: {
					type: "expense",
					accountId: chequing.id,
					date: "2026-11-14",
					payee: "Shell",
					note: null,
					lines: [{ amount: 8000, tagId: gas.id }],
				},
			},
		]);
		expect(success).toHaveBeenCalledWith("The transaction was saved.");
	});

	it("clears the destination when the transfer is made to leave it", async () => {
		const { user, writes } = renderEdit(toSavings);

		await user.selectOptions(
			await screen.findByLabelText("From the account"),
			"Savings",
		);

		expect(screen.getByLabelText("To the account")).toHaveValue("");
		await user.click(submit("Save"));
		expect(await screen.findByText("Choose an account.")).toBeVisible();
		expect(writes()).toEqual([]);
	});

	it("deletes the transaction after a confirmation, then leaves", async () => {
		const success = vi.spyOn(toast, "success").mockImplementation(() => "");
		const { user, onDone, writes } = renderEdit(fillUp, () => ({
			status: 204,
		}));

		await user.click(
			await screen.findByRole("button", { name: "Delete the transaction" }),
		);
		expect(writes()).toEqual([]);
		await user.click(
			within(
				screen.getByRole("alertdialog", { name: "Delete this transaction?" }),
			).getByRole("button", { name: "Delete" }),
		);

		await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
		expect(writes()).toEqual([
			{
				method: "DELETE",
				path: `${base}/transactions/${fillUp.id}`,
				body: undefined,
			},
		]);
		expect(success).toHaveBeenCalledWith("The transaction was deleted.");
	});

	it("offers to make it recurring, unless a recurring transaction recorded it", async () => {
		renderEdit(fillUp);

		expect(
			await screen.findByRole("link", { name: "Make it recurring" }),
		).toHaveAttribute("href", `/recurring/new?from=${fillUp.id}`);
	});

	it("doesn't offer to make recurring what a recurring transaction recorded", async () => {
		renderEdit({ ...fillUp, origin: "recurring" });

		await screen.findByRole("button", { name: "Save" });
		expect(
			screen.queryByRole("link", { name: "Make it recurring" }),
		).not.toBeInTheDocument();
	});

	it("shows a transaction without its form to a member who doesn't hold its account", async () => {
		// Recorded on Bob's card, which Alice doesn't hold
		renderEdit({ ...fillUp, accountId: bobsCard.id });

		expect(
			await screen.findByText(
				"Only the holders of its account can change this transaction.",
			),
		).toBeVisible();
		expect(screen.getByText("Shell")).toBeVisible();
		expect(screen.getByText("-$72.00")).toBeVisible();
		expect(screen.queryByLabelText("Amount")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Delete the transaction" }),
		).not.toBeInTheDocument();
	});
});
