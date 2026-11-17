import type { StatementPreview, StatementPreviewAccount } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import { initialDraft } from "@/features/imports/import-draft";
import {
	summarizeAccount,
	summarizeImport,
} from "@/features/imports/import-summary";
import {
	everydayAccount,
	savingsAccount,
	statementPreview,
} from "@/features/imports/import-test-data";

describe("summarizeImport", () => {
	it("counts what was found and what will be recorded, with the amounts", () => {
		const draft = initialDraft(statementPreview);

		expect(summarizeImport(statementPreview, draft)).toEqual({
			accounts: 2,
			skippedAccounts: 0,
			lines: 5,
			// The transfer's other side, in savings, needs no decision
			fresh: 3,
			found: { imported: 1, matched: 0, counterpart: 0, recurring: 0 },
			record: {
				expenses: { count: 1, amount: 60_50 },
				incomes: { count: 0, amount: 0 },
				// Cash taken out, and the transfer to savings counted once:
				// its other side, in the savings account, needs nothing
				transfers: { count: 2, amount: 400_00 },
				confirmed: { count: 0, amount: 0 },
				linked: 0,
				joined: 0,
				skipped: 0,
			},
			newTransactions: 3,
		});
	});

	it("leaves out an account going nowhere, and counts the lines left out", () => {
		const draft = initialDraft(statementPreview);
		draft.destinations[1] = { kind: "skip" };
		(draft.choices[0] as Record<string, unknown>)["fuel-0"] = {
			action: "skip",
		};

		const summary = summarizeImport(statementPreview, draft);

		expect(summary).toMatchObject({
			accounts: 1,
			skippedAccounts: 1,
			lines: 4,
			record: { expenses: { count: 0, amount: 0 }, skipped: 1 },
		});
	});
});

describe("summarizeAccount", () => {
	it("counts a line already entered as linked, and a recurring day as confirmed", () => {
		const [fuel, atm] = everydayAccount.lines;
		const account: StatementPreviewAccount = {
			...everydayAccount,
			lines: [
				{
					...(fuel as NonNullable<typeof fuel>),
					status: "matched",
					match: {
						transactionId: "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b9c",
						type: "expense",
						date: "2026-09-29",
						payee: "Essence",
						accountId: everydayAccount.accountId as string,
					},
				},
				{
					...(atm as NonNullable<typeof atm>),
					status: "recurring",
					suggestion: null,
					occurrence: {
						id: "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d",
						recurringId: "8b9c0d1e-2f3a-4b4c-8d5e-6f7a8b9c0d1e",
						date: "2026-10-02",
						payee: "Rent",
					},
				},
			],
		};
		const preview: StatementPreview = {
			...statementPreview,
			accounts: [account],
		};

		expect(summarizeAccount(account, initialDraft(preview))).toMatchObject({
			found: { matched: 1, recurring: 1 },
			record: { linked: 1, confirmed: { count: 1, amount: 100_00 } },
			newTransactions: 1,
		});
	});

	it("sees nothing found in an account the preview didn't compare with", () => {
		const draft = initialDraft(statementPreview);
		// Sent to a new account: what was found in the known one no longer holds
		draft.destinations[0] = {
			kind: "new",
			name: "Everyday",
			type: "checking",
			owed: "",
		};

		expect(summarizeAccount(everydayAccount, draft).found).toEqual({
			imported: 0,
			matched: 0,
			counterpart: 0,
			recurring: 0,
		});
		expect(summarizeAccount(savingsAccount, draft).lines).toBe(1);
	});
});
