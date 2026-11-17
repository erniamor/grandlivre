import type {
	Account,
	Household,
	StatementImport,
	StatementPreview,
	Tag,
} from "@repo/schemas";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ImportPage } from "@/features/imports/ImportPage";
import { statementPreview } from "@/features/imports/import-test-data";
import { setTestLocale } from "@/test/locale";
import {
	type ApiRequest,
	type ApiResponse,
	aliceProfile,
	mockApi,
} from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

const NOW = "2026-11-16T12:00:00.000Z";
const EVERYDAY = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const WALLET = "3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f";
const SAVINGS = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e";
const FUEL = "4d5e6f7a-8b9c-4d0e-9f2a-3b4c5d6e7f8a";
const IMPORT = "6f7a8b9c-0d1e-4f2a-9b3c-4d5e6f7a8b9c";

const household: Household = {
	id: "7d6c5b4a-3f2e-4d1c-8b0a-9f8e7d6c5b4a",
	name: "The Tremblays",
	currency: "CAD",
	timeZone: "America/Toronto",
	expenseSharing: false,
	role: "owner",
	createdAt: NOW,
};

const account = (
	id: string,
	name: string,
	fields: Partial<Account> = {},
): Account => ({
	id,
	householdId: household.id,
	name,
	type: "checking",
	visibility: "details",
	balance: 0,
	openingBalance: 0,
	holders: [{ userId: aliceProfile.id, name: "Alice" }],
	isHolder: true,
	archived: false,
	createdAt: NOW,
	...fields,
});

const accounts = [
	account(EVERYDAY, "Everyday", { balance: 4_539_50 }),
	account(WALLET, "Wallet", { type: "cash" }),
	account(SAVINGS, "Savings", { type: "savings" }),
];

const tags: Tag[] = [
	{
		id: FUEL,
		householdId: household.id,
		names: { en: "Fuel" },
		parentId: null,
		createdAt: NOW,
	},
];

const imported: StatementImport = {
	id: IMPORT,
	format: "desjardins_accounts",
	createdAt: NOW,
	createdBy: { userId: aliceProfile.id, name: "Alice" },
	accounts: [
		{
			accountId: EVERYDAY,
			created: 3,
			linked: 0,
			confirmed: 0,
			joined: 0,
			openingBalance: null,
		},
	],
};

const page = <T,>(data: T[]) => ({
	status: 200,
	body: { data, pagination: { page: 1, pageSize: 100, total: data.length } },
});

interface SetUpOptions {
	preview?: (request: ApiRequest) => ApiResponse;
	history?: StatementImport[];
	returnTo?: string;
}

function setUp({ preview, history = [], returnTo }: SetUpOptions = {}) {
	const requests = mockApi((request) => {
		const { method, path } = request;
		if (path.endsWith("/accounts")) {
			return page(accounts);
		}
		if (path.endsWith("/tags")) {
			return page(tags);
		}
		if (path.endsWith("/imports/preview")) {
			return preview?.(request) ?? { status: 200, body: statementPreview };
		}
		if (path.endsWith("/imports") && method === "POST") {
			return { status: 201, body: imported };
		}
		if (path.endsWith("/imports")) {
			return page(history);
		}
		if (method === "DELETE") {
			return { status: 204 };
		}
		return undefined;
	});
	const { router } = renderWithRouter(
		<ImportPage household={household} returnTo={returnTo} />,
	);
	return { requests, router, user: userEvent.setup() };
}

const file = new File(
	[
		'"Caisse du Plateau","123456","EOP","2026/10/01",1,"Achat /CAFE","",4.25,"","","","","",95.75',
	],
	"releve.csv",
	{ type: "text/csv" },
);

const sent = (requests: ApiRequest[], path: string) =>
	requests.filter(
		(request) => request.method === "POST" && request.path.endsWith(path),
	);

const jsonField = (request: ApiRequest | undefined, name: string): unknown =>
	JSON.parse(
		((request?.body as FormData | undefined)?.get(name) as string) ?? "null",
	);

describe("ImportPage", () => {
	it("reads a file, then imports it as reviewed", async () => {
		const { requests, user } = setUp();

		await user.upload(
			await screen.findByLabelText("Choose a statement file"),
			file,
		);

		const everyday = within(
			await screen.findByRole("region", { name: "Caisse du Plateau ···456" }),
		);
		expect(everyday.getByLabelText("Goes to")).toHaveValue(EVERYDAY);
		expect(
			everyday.getByText("Recognized from an earlier import."),
		).toBeVisible();
		expect(
			everyday.getByText("Already imported, left as they are: 1"),
		).toBeVisible();
		const savings = within(
			screen.getByRole("region", { name: "Caisse du Plateau ···321" }),
		);
		expect(savings.getByLabelText("Goes to")).toHaveValue("new");
		expect(savings.getByLabelText("Account name")).toHaveValue(
			"Caisse du Plateau ···321",
		);
		expect(
			savings.getByText("Other side of the transfer recorded from Everyday"),
		).toBeVisible();

		await user.click(screen.getByRole("button", { name: "Import" }));

		expect(await screen.findByText("Statement imported")).toBeVisible();
		expect(
			screen.getByText(
				"Recorded: 3 · tied to an entry: 0 · transfers completed: 0 · recurring days: 0",
			),
		).toBeVisible();
		expect(
			screen.getByText(
				"Its balance is the bank's of Thursday, October 15, 2026.",
			),
		).toBeVisible();
		expect(jsonField(sent(requests, "/imports")[0], "plan")).toEqual({
			accounts: [
				{
					index: 0,
					target: { accountId: EVERYDAY },
					lines: [
						{ externalId: "fuel-0", action: "create", tagId: FUEL },
						{ externalId: "atm-0", action: "transfer", accountId: WALLET },
						{
							externalId: "out-0",
							action: "transfer",
							pair: { index: 1, externalId: "in-0" },
						},
					],
				},
				{
					index: 1,
					target: {
						create: {
							name: "Caisse du Plateau ···321",
							type: "savings",
							visibility: "details",
							openingBalance: 10_000_00,
						},
					},
					lines: [],
				},
			],
		});
	});

	it("sums up what the file comes to, and keeps the count in sight with the import", async () => {
		const { user } = setUp();

		await user.upload(
			await screen.findByLabelText("Choose a statement file"),
			file,
		);

		const summary = within(
			await screen.findByRole("region", { name: "Summary" }),
		);
		expect(
			summary.getByText("Lines read: 5 · accounts imported: 2"),
		).toBeVisible();
		expect(summary.getByText("New transactions: 3")).toBeVisible();
		const figure = (label: string) =>
			summary.getByText(label).nextElementSibling?.textContent;
		expect(figure("Expenses")).toBe("1 · $60.50");
		expect(figure("Incomes and refunds")).toBe("0 · $0.00");
		// Cash taken out, and the transfer to savings, once
		expect(figure("Transfers")).toBe("2 · $400.00");
		expect(figure("Already imported")).toBe("1");
		expect(
			within(
				screen.getByRole("region", { name: "Caisse du Plateau ···456" }),
			).getByText(
				"New transactions: 3 · expenses $60.50 · incomes $0.00 · transfers: 2",
			),
		).toBeVisible();
		expect(screen.getByText("Transactions to add: 3")).toBeVisible();

		// A line left out: the figures follow
		await user.selectOptions(
			within(
				screen.getByRole("region", { name: "Caisse du Plateau ···456" }),
			).getAllByLabelText("What to do with this line")[0] as HTMLElement,
			"skip",
		);
		expect(await screen.findByText("Transactions to add: 2")).toBeVisible();
		expect(figure("Lines not imported")).toBe("1");
	});

	it("goes back where the page was opened from, once imported", async () => {
		const { router, user } = setUp({ returnTo: "/getting-started" });
		await user.upload(
			await screen.findByLabelText("Choose a statement file"),
			file,
		);
		await screen.findByRole("region", { name: "Caisse du Plateau ···456" });
		await user.click(screen.getByRole("button", { name: "Import" }));

		await user.click(await screen.findByRole("button", { name: "Continue" }));

		await vi.waitFor(() =>
			expect(router.state.location.pathname).toBe("/getting-started"),
		);
	});

	it("lets each line be changed: its tag, a transfer, left out", async () => {
		const { requests, user } = setUp();
		await user.upload(
			await screen.findByLabelText("Choose a statement file"),
			file,
		);
		const everyday = within(
			await screen.findByRole("region", { name: "Caisse du Plateau ···456" }),
		);
		const [fuel, cash] = everyday.getAllByRole("combobox", {
			name: "What to do with this line",
		});

		await user.selectOptions(
			everyday.getByRole("combobox", { name: "Tag" }),
			"Uncategorized",
		);
		await user.selectOptions(fuel as HTMLElement, "Don't import");
		await user.selectOptions(cash as HTMLElement, "Expense");
		await user.click(screen.getByRole("button", { name: "Import" }));

		await screen.findByText("Statement imported");
		const plan = jsonField(sent(requests, "/imports")[0], "plan") as {
			accounts: { lines: unknown[] }[];
		};
		expect(plan.accounts[0]?.lines).toEqual([
			{ externalId: "atm-0", action: "create", tagId: null },
			{
				externalId: "out-0",
				action: "transfer",
				pair: { index: 1, externalId: "in-0" },
			},
		]);
	});

	it("sends an account of the file with another, into the account made for it", async () => {
		const { requests, user } = setUp();
		await user.upload(
			await screen.findByLabelText("Choose a statement file"),
			file,
		);
		const everyday = within(
			await screen.findByRole("region", { name: "Caisse du Plateau ···456" }),
		);

		await user.selectOptions(
			everyday.getByLabelText("Goes to"),
			"With Caisse du Plateau ···321",
		);
		expect(
			everyday.getByText(
				"The same account under another number (a card replaced, say): its lines go into the account made for the other.",
			),
		).toBeVisible();
		await user.click(screen.getByRole("button", { name: "Import" }));

		await screen.findByText("Statement imported");
		const plan = jsonField(sent(requests, "/imports")[0], "plan") as {
			accounts: { index: number; target: unknown }[];
		};
		expect(
			plan.accounts.map(({ index, target }) => ({ index, target })),
		).toEqual([
			{ index: 0, target: { sameAs: 1 } },
			expect.objectContaining({ index: 1 }),
		]);
	});

	it("says what is missing before importing anything", async () => {
		const { requests, user } = setUp();
		await user.upload(
			await screen.findByLabelText("Choose a statement file"),
			file,
		);
		const everyday = within(
			await screen.findByRole("region", { name: "Caisse du Plateau ···456" }),
		);

		await user.selectOptions(
			everyday.getByRole("combobox", { name: "Transfer to" }),
			"Choose the other account",
		);
		await user.click(screen.getByRole("button", { name: "Import" }));

		expect(
			await screen.findByText("Choose the other account of this transfer."),
		).toBeVisible();
		expect(
			screen.getByText(
				"Some choices are missing: see the fields marked above.",
			),
		).toBeVisible();
		expect(sent(requests, "/imports")).toEqual([]);

		// Far below, among many lines: the first correction is brought to focus
		await user.click(
			screen.getByRole("button", { name: "Go to the first correction" }),
		);
		expect(
			everyday.getByRole("combobox", { name: "Transfer to" }),
		).toHaveFocus();
	});

	it("reads the file again when an account goes to another account", async () => {
		const { requests, user } = setUp({
			preview: (request) => {
				const targets = jsonField(request, "targets") as { index: number }[];
				const compared = targets.some((target) => target.index === 1);
				return {
					status: 200,
					body: {
						...statementPreview,
						accounts: statementPreview.accounts.map((each) =>
							compared && each.index === 1
								? { ...each, accountId: SAVINGS, writable: true }
								: each,
						),
					} satisfies StatementPreview,
				};
			},
		});
		await user.upload(
			await screen.findByLabelText("Choose a statement file"),
			file,
		);
		const savings = within(
			await screen.findByRole("region", { name: "Caisse du Plateau ···321" }),
		);

		await user.selectOptions(savings.getByLabelText("Goes to"), "Savings");

		await vi.waitFor(() =>
			expect(sent(requests, "/imports/preview")).toHaveLength(2),
		);
		expect(jsonField(sent(requests, "/imports/preview")[1], "targets")).toEqual(
			[
				{ index: 0, accountId: EVERYDAY },
				{ index: 1, accountId: SAVINGS },
			],
		);
		expect(savings.getByLabelText("Goes to")).toHaveValue(SAVINGS);
	});

	it("sets apart what is already in the app, and makes a transfer's other side the transfer", async () => {
		const withCounterpart: StatementPreview = {
			...statementPreview,
			accounts: statementPreview.accounts.map((each) =>
				each.index === 0
					? {
							...each,
							lines: [
								...each.lines,
								{
									externalId: "visa-0",
									date: "2026-10-05",
									amount: -250_00,
									description:
										"Paiement facture - AccèsD Internet /Remises Visa",
									payee: "Remises Visa",
									status: "counterpart",
									match: {
										transactionId: IMPORT,
										type: "income",
										date: "2026-10-06",
										payee: "PAIEMENT CAISSE",
										accountId: SAVINGS,
									},
									occurrence: null,
									suggestion: { kind: "transfer", accountId: SAVINGS },
									pair: null,
								},
							],
						}
					: each,
			),
		};
		const { requests, user } = setUp({
			preview: () => ({ status: 200, body: withCounterpart }),
		});
		await user.upload(
			await screen.findByLabelText("Choose a statement file"),
			file,
		);
		const everyday = within(
			await screen.findByRole("region", { name: "Caisse du Plateau ···456" }),
		);

		expect(everyday.getByText("Already entered in Savings")).toBeVisible();
		expect(
			everyday.getByRole("option", {
				name: "It's the transfer entered in Savings: “PAIEMENT CAISSE” of Oct 6, 2026",
			}),
		).toHaveProperty("selected", true);
		// What was imported before is folded away, with its badge
		const imported = everyday.getByText(
			"Already imported, left as they are: 1",
		);
		expect(everyday.getByText("Already imported")).not.toBeVisible();
		await user.click(imported);
		expect(everyday.getByText("Already imported")).toBeVisible();
		await user.click(screen.getByRole("button", { name: "Import" }));

		await screen.findByText("Statement imported");
		const plan = jsonField(sent(requests, "/imports")[0], "plan") as {
			accounts: { lines: unknown[] }[];
		};
		expect(plan.accounts[0]?.lines).toContainEqual({
			externalId: "visa-0",
			action: "join",
			transactionId: IMPORT,
		});
	});

	it("says why a file can't be read, and from which line", async () => {
		const { user } = setUp({
			preview: () => ({
				status: 422,
				body: {
					error: {
						code: "validation_error",
						message: "Invalid request",
						details: [
							{ field: "file", message: "statement_unreadable", line: 3 },
						],
					},
				},
			}),
		});

		await user.upload(
			await screen.findByLabelText("Choose a statement file"),
			file,
		);

		expect(
			await screen.findByText(
				"This file can't be read from its line 3: it isn't a statement the app knows (for now, Desjardins' CSV).",
			),
		).toBeVisible();
	});

	it("lists the member's recent imports, and undoes one", async () => {
		const { requests, user } = setUp({ history: [imported] });

		const history = within(
			await screen.findByRole("region", { name: "Your recent imports" }),
		);
		expect(history.getByText("Imported on Nov 16, 2026")).toBeVisible();
		await user.click(
			history.getByRole("button", { name: "Undo the import of Nov 16, 2026" }),
		);
		await user.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", {
				name: "Undo the import",
			}),
		);

		await vi.waitFor(() =>
			expect(requests.some((request) => request.method === "DELETE")).toBe(
				true,
			),
		);
		expect(requests.find((request) => request.method === "DELETE")?.path).toBe(
			`/households/${household.id}/imports/${IMPORT}`,
		);
	});

	it("names apart, in French, the button that undoes and the one that closes", async () => {
		setTestLocale("fr");
		const { user } = setUp({ history: [imported] });

		const history = within(
			await screen.findByRole("region", { name: "Vos imports récents" }),
		);
		await user.click(
			history.getByRole("button", { name: /^Défaire l'import du / }),
		);
		const dialog = within(await screen.findByRole("alertdialog"));

		expect(
			dialog.getByRole("heading", { name: "Défaire cet import ?" }),
		).toBeVisible();
		expect(dialog.getByRole("button", { name: "Annuler" })).toBeVisible();
		expect(
			dialog.getByRole("button", { name: "Défaire l'import" }),
		).toBeVisible();
	});
});
