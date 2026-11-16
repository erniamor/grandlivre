import {
	STATEMENT_MAX_ACCOUNTS,
	type StatementPreview,
	type StatementPreviewAccount,
	type StatementPreviewLine,
	type StatementSuggestion,
	type StatementTargets,
} from "@repo/schemas";
import {
	and,
	desc,
	eq,
	gte,
	inArray,
	isNotNull,
	lte,
	ne,
	or,
} from "drizzle-orm";
import { db } from "@/db/client";
import {
	ledgerAccounts,
	recurringOccurrences,
	recurringTransactions,
	statementAccounts,
	statementLines,
	transactionLines,
	transactions,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import type { Viewer } from "@/routes/accounts/accounts.service";
import { pairTransfers } from "@/routes/imports/in-file-pairs";
import {
	type PastTransaction,
	payeeHabits,
	suggestFromHabits,
} from "@/routes/imports/payee-suggestions";
import {
	addDays,
	MATCH_DAYS_AFTER,
	MATCH_DAYS_BEFORE,
	type MatchCandidate,
	matchLines,
} from "@/routes/imports/statement-matching";
import { hashStatementNumber } from "@/routes/imports/statement-number";
import {
	desjardinsTransferHint,
	type TransferHint,
} from "@/routes/imports/statements/desjardins";
import { descriptionKey } from "@/routes/imports/statements/fingerprint";
import { readStatement } from "@/routes/imports/statements/read-statement";
import type {
	StatementAccount,
	StatementLine,
} from "@/routes/imports/statements/statement";
import {
	type AccountAccess,
	accountAccess,
	isVisible,
} from "@/routes/transactions/transactions.service";

/** How many past transactions tell the payees' habits. */
const HABITS_FROM = 3000;

function invalid(field: string, message: string, extra?: object): AppError {
	return new AppError(422, "validation_error", "Invalid request", [
		{ field, message, ...extra },
	]);
}

/** An account of the household, as the import needs it. */
interface HouseholdAccount {
	id: string;
	type: string;
	archived: boolean;
}

/** A statement account tied to an account of the household by an earlier import. */
interface KnownStatementAccount {
	numberHash: string;
	accountId: string;
	bankName: string;
}

/** What is already in an account a line could be. */
type Candidate =
	| {
			kind: "transaction";
			transactionId: string;
			type: "expense" | "income" | "transfer";
			date: string;
			payee: string | null;
	  }
	| {
			kind: "occurrence";
			recurringId: string;
			date: string;
			payee: string | null;
	  };

/**
 * A statement file read and compared with the household, before anything
 * is imported: each of its accounts, the household's account it goes to
 * (recognized, or as `targets` says), and each line's standing there.
 * Lines are compared only with the accounts the member holds.
 */
export async function previewStatement(
	viewer: Viewer,
	file: Uint8Array,
	targets: StatementTargets,
): Promise<StatementPreview> {
	const result = readStatement(file);
	if (!result.ok) {
		throw invalid(
			"file",
			result.error,
			result.line === undefined ? undefined : { line: result.line },
		);
	}
	const { format, accounts: found } = result.statement;
	if (found.length > STATEMENT_MAX_ACCOUNTS) {
		throw invalid("file", "statement_too_long");
	}
	if (targets.some((target) => target.index >= found.length)) {
		throw invalid("targets", "import_targets_invalid");
	}
	const householdId = viewer.membership.household.id;
	const [access, accounts, known] = await Promise.all([
		accountAccess(db, viewer),
		db
			.select({
				id: ledgerAccounts.id,
				type: ledgerAccounts.type,
				archivedAt: ledgerAccounts.archivedAt,
			})
			.from(ledgerAccounts)
			.where(eq(ledgerAccounts.householdId, householdId)),
		db
			.select({
				numberHash: statementAccounts.numberHash,
				accountId: statementAccounts.accountId,
				bankName: statementAccounts.bankName,
			})
			.from(statementAccounts)
			.where(eq(statementAccounts.householdId, householdId)),
	]);
	const household: HouseholdAccount[] = accounts.map((account) => ({
		id: account.id,
		type: account.type,
		archived: account.archivedAt !== null,
	}));
	const knownByHash = new Map(known.map((each) => [each.numberHash, each]));

	const destinations = found.map((statementAccount, index) => {
		const recognized = knownByHash.get(
			hashStatementNumber(statementAccount.number),
		);
		const chosen = targets.find((target) => target.index === index);
		const accountId = chosen?.accountId ?? recognized?.accountId ?? null;
		const rights = accountId ? access.get(accountId) : undefined;
		if (chosen && (!rights?.isHolder || rights.archived)) {
			// Only into an account of the household the member holds, still open
			throw invalid("targets", "import_account_invalid");
		}
		return {
			accountId,
			recognized: accountId !== null && accountId === recognized?.accountId,
			writable: Boolean(rights?.isHolder && !rights.archived),
		};
	});

	const habits = payeeHabits(await pastTransactions(householdId, access));
	const previewed: StatementPreviewAccount[] = [];
	for (const [index, statementAccount] of found.entries()) {
		const { accountId, recognized, writable } = destinations[index] ?? {
			accountId: null,
			recognized: false,
			writable: false,
		};
		const standing =
			accountId && writable
				? await standingOf(householdId, accountId, statementAccount.lines)
				: new Map<number, Standing>();
		previewed.push({
			index,
			bankName: statementAccount.bankName,
			numberEnd: statementAccount.numberEnd,
			type: statementAccount.type,
			openingBalance: statementAccount.openingBalance,
			closingBalance: statementAccount.closingBalance,
			from: statementAccount.lines[0]?.date ?? "",
			to: statementAccount.lines.at(-1)?.date ?? "",
			accountId,
			recognized,
			writable,
			lines: statementAccount.lines.map((line, at) =>
				previewLine(line, standing.get(at), () =>
					// What the line likely is matters only while it is new, into
					// an account the member may fill
					accountId === null || writable
						? suggest(line, statementAccount, accountId, {
								household,
								knownByHash,
								access,
								habits,
							})
						: null,
				),
			),
		});
	}
	pairWithinFile(previewed, found, destinations);
	return { format, accounts: previewed };
}

/** Where a line stands in the account it goes to, when it isn't new. */
type Standing =
	| {
			status: "imported";
			candidate: Extract<Candidate, { kind: "transaction" }>;
	  }
	| {
			status: "matched";
			candidate: Extract<Candidate, { kind: "transaction" }>;
	  }
	| {
			status: "recurring";
			candidate: Extract<Candidate, { kind: "occurrence" }>;
	  };

function previewLine(
	line: StatementLine,
	standing: Standing | undefined,
	suggestion: () => StatementSuggestion | null,
): StatementPreviewLine {
	const base = {
		externalId: line.externalId,
		date: line.date,
		amount: line.amount,
		description: line.description,
		payee: line.payee,
		match: null,
		occurrence: null,
		suggestion: null,
		pair: null,
	};
	if (!standing) {
		return { ...base, status: "new", suggestion: suggestion() };
	}
	const { candidate } = standing;
	return candidate.kind === "transaction"
		? {
				...base,
				status: standing.status,
				match: {
					transactionId: candidate.transactionId,
					type: candidate.type,
					date: candidate.date,
					payee: candidate.payee,
				},
			}
		: {
				...base,
				status: "recurring",
				occurrence: {
					recurringId: candidate.recurringId,
					date: candidate.date,
					payee: candidate.payee,
				},
			};
}

/**
 * The lines already imported into the account, then the ones its
 * transactions or its recurring days waiting look like: a transaction is
 * tied to one line of its account's statements at most.
 */
async function standingOf(
	householdId: string,
	accountId: string,
	lines: StatementLine[],
): Promise<Map<number, Standing>> {
	const standing = new Map<number, Standing>();
	if (lines.length === 0) {
		return standing;
	}
	const imported = await db
		.select({
			externalId: statementLines.externalId,
			transactionId: transactions.id,
			type: transactions.type,
			date: transactions.date,
			payee: transactions.payee,
		})
		.from(statementLines)
		.innerJoin(transactions, eq(transactions.id, statementLines.transactionId))
		.where(
			and(
				eq(statementLines.accountId, accountId),
				inArray(
					statementLines.externalId,
					lines.map((line) => line.externalId),
				),
			),
		);
	const importedById = new Map(imported.map((row) => [row.externalId, row]));
	for (const [at, line] of lines.entries()) {
		const row = importedById.get(line.externalId);
		if (row) {
			standing.set(at, {
				status: "imported",
				candidate: { kind: "transaction", ...row },
			});
		}
	}

	const dates = lines.map((line) => line.date).sort();
	const from = addDays(dates[0] ?? "", -MATCH_DAYS_AFTER);
	const to = addDays(dates.at(-1) ?? "", MATCH_DAYS_BEFORE);
	const touches = or(
		eq(transactions.accountId, accountId),
		eq(transactions.toAccountId, accountId),
	);
	const [recorded, linked, waiting] = await Promise.all([
		db
			.select({
				id: transactions.id,
				type: transactions.type,
				date: transactions.date,
				accountId: transactions.accountId,
				amount: transactions.amount,
				payee: transactions.payee,
			})
			.from(transactions)
			.where(
				and(
					eq(transactions.householdId, householdId),
					touches,
					gte(transactions.date, from),
					lte(transactions.date, to),
					// An adjustment is the app's own: no bank line is it
					ne(transactions.origin, "adjustment"),
				),
			),
		// Already some other line of this account's statements
		db
			.select({ transactionId: statementLines.transactionId })
			.from(statementLines)
			.innerJoin(
				transactions,
				eq(transactions.id, statementLines.transactionId),
			)
			.where(
				and(
					eq(statementLines.accountId, accountId),
					gte(transactions.date, from),
					lte(transactions.date, to),
				),
			),
		db
			.select({
				recurringId: recurringOccurrences.recurringId,
				date: recurringOccurrences.date,
				type: recurringTransactions.type,
				accountId: recurringTransactions.accountId,
				amount: recurringTransactions.amount,
				payee: recurringTransactions.payee,
			})
			.from(recurringOccurrences)
			.innerJoin(
				recurringTransactions,
				eq(recurringTransactions.id, recurringOccurrences.recurringId),
			)
			.where(
				and(
					eq(recurringOccurrences.householdId, householdId),
					eq(recurringOccurrences.status, "pending"),
					or(
						eq(recurringTransactions.accountId, accountId),
						eq(recurringTransactions.toAccountId, accountId),
					),
					gte(recurringOccurrences.date, from),
					lte(recurringOccurrences.date, to),
				),
			),
	]);
	const taken = new Set(linked.map((row) => row.transactionId));
	// The money as the account sees it: out of it negative, into it positive
	const signed = (type: string, from_: string, amount: number) =>
		type === "income" || (type === "transfer" && from_ !== accountId)
			? amount
			: -amount;
	const candidates: MatchCandidate<Candidate>[] = [
		...recorded
			.filter((row) => !taken.has(row.id))
			.map((row) => ({
				ref: {
					kind: "transaction" as const,
					transactionId: row.id,
					type: row.type,
					date: row.date,
					payee: row.payee,
				},
				date: row.date,
				amount: signed(row.type, row.accountId, row.amount),
				rank: 0,
			})),
		...waiting.map((row) => ({
			ref: {
				kind: "occurrence" as const,
				recurringId: row.recurringId,
				date: row.date,
				payee: row.payee,
			},
			date: row.date,
			amount: signed(row.type, row.accountId, row.amount),
			rank: 1,
		})),
	];
	const open = lines
		.map((line, at) => ({ line, at }))
		.filter(({ at }) => !standing.has(at));
	const matched = matchLines(
		open.map(({ line }) => line),
		candidates,
	);
	for (const [openAt, candidate] of matched) {
		const at = open[openAt]?.at;
		if (at === undefined) {
			continue;
		}
		standing.set(
			at,
			candidate.kind === "transaction"
				? { status: "matched", candidate }
				: { status: "recurring", candidate },
		);
	}
	return standing;
}

/** The household's recent transactions the member may see, most recent first. */
async function pastTransactions(
	householdId: string,
	access: Map<string, AccountAccess>,
): Promise<PastTransaction[]> {
	const rows = await db
		.select({
			id: transactions.id,
			payee: transactions.payee,
			type: transactions.type,
			accountId: transactions.accountId,
			toAccountId: transactions.toAccountId,
		})
		.from(transactions)
		.where(
			and(
				eq(transactions.householdId, householdId),
				isNotNull(transactions.payee),
				ne(transactions.origin, "adjustment"),
			),
		)
		.orderBy(desc(transactions.date), desc(transactions.createdAt))
		.limit(HABITS_FROM);
	const visible = rows.filter((row) => isVisible(row, access));
	const lines =
		visible.length === 0
			? []
			: await db
					.select({
						transactionId: transactionLines.transactionId,
						tagId: transactionLines.tagId,
					})
					.from(transactionLines)
					.where(
						inArray(
							transactionLines.transactionId,
							visible.map((row) => row.id),
						),
					);
	const tagsOf = new Map<string, (string | null)[]>();
	for (const line of lines) {
		tagsOf.set(line.transactionId, [
			...(tagsOf.get(line.transactionId) ?? []),
			line.tagId,
		]);
	}
	return visible.map((row) => ({
		payee: row.payee ?? "",
		type: row.type,
		accountId: row.accountId,
		toAccountId: row.toAccountId,
		tagIds: tagsOf.get(row.id) ?? [],
	}));
}

interface SuggestContext {
	household: HouseholdAccount[];
	knownByHash: Map<string, KnownStatementAccount>;
	access: Map<string, AccountAccess>;
	habits: ReturnType<typeof payeeHabits>;
}

/**
 * What a new line likely is: a transfer its description names (another
 * account, a card, the wallet), else what its payee was before.
 */
function suggest(
	line: StatementLine,
	statementAccount: StatementAccount,
	accountId: string | null,
	context: SuggestContext,
): StatementSuggestion | null {
	const hint = desjardinsTransferHint(
		statementAccount.number,
		line.description,
	);
	const other = hint ? transferAccount(hint, context) : null;
	if (other && other !== accountId) {
		return { kind: "transfer", accountId: other };
	}
	return suggestFromHabits(context.habits, line.payee, accountId);
}

/** The household's account a transfer hint names, when exactly one fits. */
function transferAccount(
	hint: TransferHint,
	{ household, knownByHash, access }: SuggestContext,
): string | null {
	const open = (id: string) =>
		household.some((account) => account.id === id && !account.archived);
	if (hint.kind === "account") {
		const known = knownByHash.get(hashStatementNumber(hint.number));
		return known && open(known.accountId) ? known.accountId : null;
	}
	if (hint.kind === "card") {
		const name = descriptionKey(hint.name);
		const cards = [...knownByHash.values()].filter(
			(known) =>
				open(known.accountId) &&
				household.find((account) => account.id === known.accountId)?.type ===
					"credit_card" &&
				name.includes(descriptionKey(known.bankName)),
		);
		const ids = new Set(cards.map((card) => card.accountId));
		return ids.size === 1 ? ([...ids][0] ?? null) : null;
	}
	// The member's own wallet, when they have one
	const wallets = household.filter(
		(account) =>
			account.type === "cash" &&
			!account.archived &&
			access.get(account.id)?.isHolder,
	);
	return wallets.length === 1 ? (wallets[0]?.id ?? null) : null;
}

/**
 * The transfers between two accounts of the file, seen on both: each side
 * points to the other, and is suggested as a transfer to the other's
 * account when it has one.
 */
function pairWithinFile(
	previewed: StatementPreviewAccount[],
	found: StatementAccount[],
	destinations: { accountId: string | null }[],
): void {
	const indexOfNumber = new Map(
		found.map((statementAccount, index) => [statementAccount.number, index]),
	);
	const pairable = previewed.flatMap((account) =>
		account.lines
			.filter((line) => line.status === "new")
			.map((line) => {
				const hint = desjardinsTransferHint(
					found[account.index]?.number ?? "",
					line.description,
				);
				return {
					index: account.index,
					externalId: line.externalId,
					date: line.date,
					amount: line.amount,
					otherIndex:
						hint?.kind === "account"
							? (indexOfNumber.get(hint.number) ?? null)
							: null,
				};
			}),
	);
	const pairs = pairTransfers(pairable);
	for (const account of previewed) {
		for (const line of account.lines) {
			const pair = pairs.get(`${account.index}:${line.externalId}`);
			if (!pair) {
				continue;
			}
			line.pair = pair;
			const other = destinations[pair.index]?.accountId;
			if (other && other !== account.accountId) {
				line.suggestion = { kind: "transfer", accountId: other };
			}
		}
	}
}
