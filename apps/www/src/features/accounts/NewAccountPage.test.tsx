import { toast } from "@repo/ui";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	BOB_ID,
	chequing,
	household,
	members,
	page,
} from "@/features/accounts/account-test-data";
import { NewAccountPage } from "@/features/accounts/NewAccountPage";
import { setTestLocale } from "@/test/locale";
import {
	type ApiRequest,
	type ApiResponse,
	aliceProfile,
	mockApi,
} from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

afterEach(() => {
	vi.restoreAllMocks();
});

const base = `/households/${household.id}`;

function setUp(
	respond: (request: ApiRequest) => ApiResponse | undefined = () => ({
		status: 201,
		body: chequing,
	}),
) {
	const requests = mockApi((request) =>
		request.method === "GET" && request.path === `${base}/members`
			? page(members)
			: respond(request),
	);
	const onCreated = vi.fn();
	renderWithRouter(
		<NewAccountPage
			me={aliceProfile}
			household={household}
			onCreated={onCreated}
		/>,
	);
	return {
		user: userEvent.setup(),
		onCreated,
		/** The requests that change something, without the reads. */
		writes: () => requests.filter((request) => request.method === "POST"),
	};
}

describe("NewAccountPage", () => {
	it.each([
		["en", "New account", "Account name", "Opening balance"],
		["fr", "Nouveau compte", "Nom du compte", "Solde d'ouverture"],
		["es", "Nueva cuenta", "Nombre de la cuenta", "Saldo inicial"],
	] as const)(
		"shows the form, in %s",
		async (locale, title, nameLabel, balanceLabel) => {
			setTestLocale(locale);
			setUp();

			expect(
				await screen.findByRole("heading", { level: 1, name: title }),
			).toBeVisible();
			expect(screen.getByLabelText(nameLabel)).toBeVisible();
			expect(screen.getByLabelText(balanceLabel)).toBeVisible();
		},
	);

	it("creates a chequing account held by the user, visible in detail, by default", async () => {
		const success = vi.spyOn(toast, "success").mockImplementation(() => "");
		const { user, onCreated, writes } = setUp();

		await user.type(await screen.findByLabelText("Account name"), " Everyday ");
		await user.type(screen.getByLabelText("Opening balance"), "1,250.50");
		await user.click(
			screen.getByRole("button", { name: "Create the account" }),
		);

		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(writes()).toEqual([
			{
				method: "POST",
				path: `${base}/accounts`,
				body: {
					name: "Everyday",
					type: "checking",
					visibility: "details",
					holderIds: [aliceProfile.id],
					openingBalance: 125_050,
				},
			},
		]);
		expect(success).toHaveBeenCalledWith("The account was created.");
	});

	it("reads the balance in the user's language", async () => {
		setTestLocale("fr");
		const { user, onCreated, writes } = setUp();

		await user.type(await screen.findByLabelText("Nom du compte"), "Courant");
		await user.type(screen.getByLabelText("Solde d'ouverture"), "1 250,50");
		await user.click(screen.getByRole("button", { name: "Créer le compte" }));

		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(writes()).toMatchObject([{ body: { openingBalance: 125_050 } }]);
	});

	it("asks what is owed on a credit card, and stores it as a negative balance", async () => {
		const { user, onCreated, writes } = setUp();

		await user.type(await screen.findByLabelText("Account name"), "Visa");
		await user.selectOptions(screen.getByLabelText("Type"), "Credit card");
		expect(screen.queryByLabelText("Opening balance")).not.toBeInTheDocument();
		await user.type(screen.getByLabelText("Amount owed"), "450");
		await user.click(
			screen.getByRole("button", { name: "Create the account" }),
		);

		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(writes()).toMatchObject([
			{ body: { type: "credit_card", openingBalance: -45_000 } },
		]);
	});

	it("creates a shared account, showing only its balance to the others", async () => {
		const { user, onCreated, writes } = setUp();

		await user.type(await screen.findByLabelText("Account name"), "Joint");
		await user.type(screen.getByLabelText("Opening balance"), "0");
		await user.click(screen.getByRole("checkbox", { name: "Bob" }));
		await user.selectOptions(
			screen.getByLabelText("What the other members see"),
			"The balance only",
		);
		await user.click(
			screen.getByRole("button", { name: "Create the account" }),
		);

		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(writes()).toMatchObject([
			{
				body: {
					visibility: "balance",
					holderIds: [aliceProfile.id, BOB_ID],
					openingBalance: 0,
				},
			},
		]);
	});

	it("always keeps the user among the holders", async () => {
		setUp();

		const alice = await screen.findByRole("checkbox", { name: "Alice" });

		expect(alice).toBeChecked();
		expect(alice).toBeDisabled();
		expect(screen.getByRole("checkbox", { name: "Bob" })).not.toBeChecked();
	});

	it("explains the visibility, the holders and the opening balance where they are asked", async () => {
		const { user } = setUp();

		await user.click(
			await screen.findByRole("button", {
				name: "What does the visibility change?",
			}),
		);

		expect(screen.getByText(/its balance only/)).toBeVisible();
		expect(
			screen.getByRole("button", { name: "Who are the holders?" }),
		).toBeVisible();
		expect(
			screen.getByRole("button", { name: "What is the opening balance?" }),
		).toBeVisible();
	});

	it("refuses a balance that isn't an amount, without calling the API", async () => {
		const { user, onCreated, writes } = setUp();

		await user.type(await screen.findByLabelText("Account name"), "Everyday");
		await user.type(screen.getByLabelText("Opening balance"), "a lot");
		await user.click(
			screen.getByRole("button", { name: "Create the account" }),
		);

		expect(
			await screen.findByText("Enter an amount, like 1250.50."),
		).toBeVisible();
		expect(writes()).toEqual([]);
		expect(onCreated).not.toHaveBeenCalled();
	});

	it("asks for a name before calling the API", async () => {
		const { user, writes } = setUp();

		await user.type(await screen.findByLabelText("Opening balance"), "10");
		await user.click(
			screen.getByRole("button", { name: "Create the account" }),
		);

		expect(
			await screen.findByText("Enter a name for the account."),
		).toBeVisible();
		expect(writes()).toEqual([]);
	});

	it("shows the API's validation errors next to their field", async () => {
		const { user, onCreated } = setUp(() => ({
			status: 422,
			body: {
				error: {
					code: "validation_error",
					message: "Invalid request",
					details: [
						{ field: "holderIds", message: "account_holders_invalid" },
						{ field: "openingBalance", message: "amount_too_large" },
					],
				},
			},
		}));

		await user.type(await screen.findByLabelText("Account name"), "Everyday");
		await user.type(screen.getByLabelText("Opening balance"), "10");
		await user.click(
			screen.getByRole("button", { name: "Create the account" }),
		);

		expect(
			await screen.findByText(
				"These holders aren't all members of the household.",
			),
		).toBeVisible();
		expect(screen.getByText("This amount is too large.")).toBeVisible();
		expect(onCreated).not.toHaveBeenCalled();
	});

	it("links back to the accounts", async () => {
		setUp();

		expect(
			await screen.findByRole("link", { name: "Back to the accounts" }),
		).toHaveAttribute("href", "/accounts");
	});
});
