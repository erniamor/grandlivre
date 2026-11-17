import type { StatementPreview, StatementPreviewAccount } from "@repo/schemas";
import {
	type ImportDraft,
	lineStatus,
	pairedBy,
	standingHolds,
} from "@/features/imports/import-draft";

/** How many lines, and what they add up to (in minor units, positive). */
export interface Tally {
	count: number;
	amount: number;
}

/**
 * What a statement's review comes to: what the preview found in the app,
 * and what the import will record.
 */
export interface ImportSummary {
	/** The accounts of the file going somewhere, and those going nowhere. */
	accounts: number;
	skippedAccounts: number;
	/** The lines read, of the accounts going somewhere. */
	lines: number;
	/** What was found: already imported, already entered, a transfer's other side entered elsewhere, a recurring day waiting. */
	found: {
		imported: number;
		matched: number;
		counterpart: number;
		recurring: number;
	};
	/** What the import records. */
	record: {
		/** New expenses and incomes: money out, money in. */
		expenses: Tally;
		incomes: Tally;
		/** New transfers between accounts, each once (its other side in the file needs nothing). */
		transfers: Tally;
		/** Recurring days recorded. */
		confirmed: Tally;
		/** Tied to a transaction already entered: nothing new. */
		linked: number;
		/** The other side, entered elsewhere, becomes the transfer: nothing new. */
		joined: number;
		/** Left out by the member. */
		skipped: number;
	};
	/** The transactions the import adds: expenses, incomes, transfers and recurring days. */
	newTransactions: number;
}

function emptySummary(): ImportSummary {
	return {
		accounts: 0,
		skippedAccounts: 0,
		lines: 0,
		found: { imported: 0, matched: 0, counterpart: 0, recurring: 0 },
		record: {
			expenses: { count: 0, amount: 0 },
			incomes: { count: 0, amount: 0 },
			transfers: { count: 0, amount: 0 },
			confirmed: { count: 0, amount: 0 },
			linked: 0,
			joined: 0,
			skipped: 0,
		},
		newTransactions: 0,
	};
}

function add(tally: Tally, amount: number): void {
	tally.count += 1;
	tally.amount += Math.abs(amount);
}

/**
 * What an account of the file comes to, where it goes; nothing for one
 * going nowhere.
 */
export function summarizeAccount(
	account: StatementPreviewAccount,
	draft: ImportDraft,
): ImportSummary {
	const summary = emptySummary();
	const destination = draft.destinations[account.index];
	if (!destination || destination.kind === "skip") {
		summary.skippedAccounts = 1;
		return summary;
	}
	summary.accounts = 1;
	const holds = standingHolds(account, destination);
	const { found, record } = summary;
	for (const line of account.lines) {
		summary.lines += 1;
		const status = lineStatus(line, holds, destination);
		if (status !== "new") {
			found[status] += 1;
		}
		// Recorded by its other side, in the file
		if (pairedBy(draft, account.index, line)) {
			continue;
		}
		const choice = draft.choices[account.index]?.[line.externalId];
		switch (choice?.action) {
			case "create":
				add(line.amount < 0 ? record.expenses : record.incomes, line.amount);
				break;
			case "transfer":
				add(record.transfers, line.amount);
				break;
			case "confirm":
				add(record.confirmed, line.amount);
				break;
			case "link":
				record.linked += 1;
				break;
			case "join":
				record.joined += 1;
				break;
			case "skip":
				record.skipped += 1;
				break;
			default:
				// Imported before: nothing to decide
				break;
		}
	}
	summary.newTransactions =
		record.expenses.count +
		record.incomes.count +
		record.transfers.count +
		record.confirmed.count;
	return summary;
}

const FOUND_KINDS = [
	"imported",
	"matched",
	"counterpart",
	"recurring",
] as const;

function addTally(into: Tally, from: Tally): void {
	into.count += from.count;
	into.amount += from.amount;
}

/** What the whole file comes to: its accounts' summaries added up. */
export function summarizeImport(
	preview: StatementPreview,
	draft: ImportDraft,
): ImportSummary {
	const total = emptySummary();
	for (const account of preview.accounts) {
		const each = summarizeAccount(account, draft);
		total.accounts += each.accounts;
		total.skippedAccounts += each.skippedAccounts;
		total.lines += each.lines;
		for (const key of FOUND_KINDS) {
			total.found[key] += each.found[key];
		}
		addTally(total.record.expenses, each.record.expenses);
		addTally(total.record.incomes, each.record.incomes);
		addTally(total.record.transfers, each.record.transfers);
		addTally(total.record.confirmed, each.record.confirmed);
		total.record.linked += each.record.linked;
		total.record.joined += each.record.joined;
		total.record.skipped += each.record.skipped;
		total.newTransactions += each.newTransactions;
	}
	return total;
}
