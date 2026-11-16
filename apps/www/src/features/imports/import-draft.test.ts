import type {
	Account,
	StatementPreview,
	StatementPreviewLine,
} from "@repo/schemas";
import { describe, expect, it } from "vitest";
import {
	buildPlan,
	countChoices,
	type ImportDraft,
	initialChoice,
	initialDraft,
	openingBalanceOf,
	pairedBy,
	redraft,
	targetsOf,
	transferAccounts,
} from "@/features/imports/import-draft";
import {
	everydayAccount,
	savingsAccount,
	statementPreview,
	transferIn,
} from "@/features/imports/import-test-data";

const EVERYDAY = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const SAVINGS = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e";
const WALLET = "3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f";

const line = (fields: Partial<StatementPreviewLine>): StatementPreviewLine => ({
	externalId: "x-0",
	date: "2026-10-01",
	amount: -10_00,
	description: "Achat /CAFE",
	payee: "CAFE",
	status: "new",
	match: null,
	occurrence: null,
	suggestion: null,
	pair: null,
	...fields,
});

describe("initialChoice", () => {
	it("ties a line to what is there, records a waiting day, skips one imported", () => {
		expect(
			initialChoice(
				line({
					status: "matched",
					match: {
						transactionId: EVERYDAY,
						type: "expense",
						date: "2026-10-01",
						payee: null,
					},
				}),
			),
		).toEqual({ action: "link", transactionId: EVERYDAY });
		expect(
			initialChoice(
				line({
					status: "recurring",
					occurrence: {
						id: SAVINGS,
						recurringId: WALLET,
						date: "2026-10-01",
						payee: null,
					},
				}),
			),
		).toEqual({ action: "confirm", occurrenceId: SAVINGS });
		expect(initialChoice(line({ status: "imported" }))).toBeNull();
	});

	it("follows a new line's suggestion, or makes it uncategorized", () => {
		expect(
			initialChoice(line({ suggestion: { kind: "tag", tagId: SAVINGS } })),
		).toEqual({ action: "create", tagId: SAVINGS });
		expect(
			initialChoice(
				line({ suggestion: { kind: "transfer", accountId: WALLET } }),
			),
		).toEqual({ action: "transfer", accountId: WALLET });
		expect(initialChoice(line({}))).toEqual({ action: "create", tagId: null });
	});

	it("records a transfer seen from both accounts from the side the money leaves", () => {
		const pair = { index: 1, externalId: "y-0" };

		expect(initialChoice(line({ pair }))).toEqual({
			action: "transfer",
			accountId: null,
			pair: true,
		});
		expect(initialChoice(line({ amount: 10_00, pair }))).toEqual({
			action: "skip",
		});
	});
});

describe("initialDraft and targetsOf", () => {
	it("sends each account where the preview found it, or to a new one named after it", () => {
		const draft = initialDraft(statementPreview);

		expect(draft.destinations).toEqual({
			0: { kind: "account", accountId: EVERYDAY },
			1: {
				kind: "new",
				name: "Caisse du Plateau ···321",
				type: "savings",
				owed: "",
			},
		});
		expect(targetsOf(draft)).toEqual([{ index: 0, accountId: EVERYDAY }]);
	});

	it("sends a file's one account to the account the page was opened from", () => {
		const one: StatementPreview = {
			...statementPreview,
			accounts: [{ ...savingsAccount, index: 0 }],
		};

		expect(initialDraft(one, SAVINGS).destinations[0]).toEqual({
			kind: "account",
			accountId: SAVINGS,
		});
	});
});

describe("redraft", () => {
	it("keeps the choices of the accounts that go where they went", () => {
		const draft: ImportDraft = {
			...initialDraft(statementPreview),
			choices: {
				0: { "a-0": { action: "skip" } },
				1: { "b-0": { action: "skip" } },
			},
		};
		const moved: StatementPreview = {
			...statementPreview,
			accounts: statementPreview.accounts.map((account) =>
				account.index === 1 ? { ...account, accountId: SAVINGS } : account,
			),
		};

		const next = redraft(draft, statementPreview, moved);

		expect(next.choices[0]).toEqual({ "a-0": { action: "skip" } });
		expect(next.choices[1]).not.toEqual({ "b-0": { action: "skip" } });
	});
});

describe("buildPlan", () => {
	it("turns the choices into the plan, with the other side of a transfer left to its pair", () => {
		const draft = initialDraft(statementPreview);
		draft.destinations[1] = { kind: "account", accountId: SAVINGS };

		const { plan } = buildPlan(statementPreview, draft, "CAD", "en");

		expect(plan).toEqual({
			accounts: [
				{
					index: 0,
					target: { accountId: EVERYDAY },
					lines: [
						{
							externalId: "fuel-0",
							action: "create",
							tagId: "4d5e6f7a-8b9c-4d0e-9f2a-3b4c5d6e7f8a",
						},
						{ externalId: "atm-0", action: "transfer", accountId: WALLET },
						{
							externalId: "out-0",
							action: "transfer",
							pair: { index: 1, externalId: "in-0" },
						},
					],
				},
				{ index: 1, target: { accountId: SAVINGS }, lines: [] },
			],
		});
		expect(pairedBy(draft, 1, transferIn)).toEqual({
			index: 0,
			externalId: "out-0",
		});
		expect(countChoices(savingsAccount, draft).paired).toBe(1);
	});

	it("makes a new account at the statement's opening balance, and leaves out an account skipped", () => {
		const draft = initialDraft(statementPreview);
		draft.destinations[0] = { kind: "skip" };
		// The transfer's other side no longer has its pair: a line of its own
		draft.choices[1] = { "in-0": { action: "create", tagId: null } };

		const { plan } = buildPlan(statementPreview, draft, "CAD", "en");

		expect(plan?.accounts).toEqual([
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
				lines: [{ externalId: "in-0", action: "create", tagId: null }],
			},
		]);
	});

	it("says what is missing: a name, what a card owes, a transfer's account, anything", () => {
		const card = {
			...savingsAccount,
			type: "credit_card" as const,
			openingBalance: null,
			closingBalance: null,
		};
		const preview: StatementPreview = {
			...statementPreview,
			accounts: [everydayAccount, card],
		};
		const draft = initialDraft(preview);
		draft.destinations[1] = {
			kind: "new",
			name: " ",
			type: "credit_card",
			owed: "lots",
		};
		draft.choices[0] = { "atm-0": { action: "transfer", accountId: null } };

		expect(buildPlan(preview, draft, "CAD", "en").problems).toEqual([
			{ kind: "transfer", index: 0, externalId: "atm-0" },
			{ kind: "name", index: 1 },
			{ kind: "owed", index: 1 },
		]);
		expect(
			buildPlan(
				preview,
				{
					...draft,
					destinations: { 0: { kind: "skip" }, 1: { kind: "skip" } },
				},
				"CAD",
				"en",
			).problems,
		).toEqual([{ kind: "nothing" }]);
	});
});

describe("openingBalanceOf", () => {
	it("finds a card's opening balance from what it owes today, less its lines", () => {
		// Lines of the account: +300.00 in all
		const card = {
			...savingsAccount,
			openingBalance: null,
		};

		expect(
			openingBalanceOf(
				card,
				{ kind: "new", name: "Visa", type: "credit_card", owed: "1,250.50" },
				"CAD",
				"en",
			),
		).toBe(-1_250_50 - 300_00);
		expect(
			openingBalanceOf(
				card,
				{ kind: "new", name: "Visa", type: "credit_card", owed: "" },
				"CAD",
				"en",
			),
		).toBeNull();
	});
});

describe("transferAccounts", () => {
	const account = (id: string, fields: Partial<Account>) =>
		({ id, isHolder: true, archived: false, ...fields }) as Account;
	const accounts = [
		account(EVERYDAY, {}),
		account(SAVINGS, { isHolder: false }),
		account(WALLET, { archived: true }),
	];

	it("offers any open account to send money to, only one's own to receive it from", () => {
		const destination = { kind: "account" as const, accountId: EVERYDAY };

		expect(
			transferAccounts(accounts, line({ amount: -5_00 }), destination).map(
				(each) => each.id,
			),
		).toEqual([SAVINGS]);
		expect(
			transferAccounts(accounts, line({ amount: 5_00 }), undefined).map(
				(each) => each.id,
			),
		).toEqual([EVERYDAY]);
	});
});
