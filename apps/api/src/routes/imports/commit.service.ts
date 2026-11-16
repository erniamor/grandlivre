import { randomUUID } from "node:crypto";
import {
	type Paginated,
	type StatementImport,
	type StatementImportPlan,
	type StatementLineDecision,
	TRANSACTION_PAYEE_MAX_LENGTH,
} from "@repo/schemas";
import { and, count, desc, eq, inArray, lt, notInArray, or } from "drizzle-orm";
import { db, type Transaction as Tx } from "@/db/client";
import {
	ledgerAccounts,
	recurringOccurrences,
	recurringTransactionLines,
	recurringTransactions,
	statementAccounts,
	statementImports,
	statementLines,
	tags,
	transactionLines,
	transactions,
	users,
} from "@/db/schema";
import type { JoinedBefore, OpeningChange } from "@/db/schema/statements";
import { AppError } from "@/lib/errors";
import { publishHouseholdEvent } from "@/lib/events";
import { offsetOf, type PaginationQuery } from "@/lib/pagination";
import { insertAccount, type Viewer } from "@/routes/accounts/accounts.service";
import { hashStatementNumber } from "@/routes/imports/statement-number";
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

/** Rows written at once: well within PostgreSQL's limit on parameters. */
const CHUNK = 500;

function invalid(field: string, message: string): AppError {
	return new AppError(422, "validation_error", "Invalid request", [
		{ field, message },
	]);
}

function chunks<T>(rows: T[]): T[][] {
	const parts: T[][] = [];
	for (let at = 0; at < rows.length; at += CHUNK) {
		parts.push(rows.slice(at, at + CHUNK));
	}
	return parts;
}

/** The money as an account sees it: out of it negative, into it positive. */
function signedFor(
	accountId: string,
	row: { type: string; accountId: string; amount: number },
): number {
	return row.type === "income" ||
		(row.type === "transfer" && row.accountId !== accountId)
		? row.amount
		: -row.amount;
}

/** An account of the file and the household's account it goes to. */
interface Destination {
	index: number;
	statementAccount: StatementAccount;
	accountId: string;
	/** Where its lines' errors are named: `accounts.<place in the plan>`. */
	field: string;
}

/** A transaction about to be written, with what ties it to the statement. */
interface Planned {
	id: string;
	values: typeof transactions.$inferInsert;
	lines: { amount: number; tagId: string | null }[];
	/** The statement lines it is: one, or both sides of a transfer. */
	sources: { accountId: string; externalId: string }[];
	kind: "created" | "confirmed";
	occurrenceId?: string;
}

/**
 * Imports a statement as the member decided after its preview, all at
 * once or not at all: each account of the plan goes to an account the
 * member holds, or to a new one; each line decided becomes a transaction,
 * a transfer, is tied to a transaction already there, or records a
 * recurring day. The statement's accounts are remembered for the next
 * imports.
 */
export async function importStatement(
	viewer: Viewer,
	file: Uint8Array,
	plan: StatementImportPlan,
): Promise<StatementImport> {
	const result = readStatement(file);
	if (!result.ok) {
		throw invalid("file", result.error);
	}
	const { format, accounts: found } = result.statement;
	const householdId = viewer.membership.household.id;

	return db.transaction(async (tx) => {
		const access = await accountAccess(tx, viewer);
		const destinations = await resolveDestinations(
			tx,
			viewer,
			access,
			plan,
			found,
		);
		const decided = decisionsOf(plan, destinations);
		await assertNotImported(tx, decided, destinations);

		const [created] = await tx
			.insert(statementImports)
			.values({ householdId, format, createdBy: viewer.userId })
			.returning();
		if (!created) {
			throw new Error("The import was not recorded");
		}
		const planned: Planned[] = [];
		const linked: {
			accountId: string;
			externalId: string;
			transactionId: string;
		}[] = [];
		const joins: Join[] = [];
		await assertTags(tx, householdId, decided);
		for (const each of decided) {
			const { decision, line, destination, field } = each;
			const source = {
				accountId: destination.accountId,
				externalId: line.externalId,
			};
			if (decision.action === "create") {
				planned.push(
					expenseOrIncome(viewer, destination, line, decision, source),
				);
			} else if (decision.action === "transfer") {
				planned.push(transfer(viewer, access, each, source, field));
			} else if (decision.action === "link") {
				linked.push({ ...source, transactionId: decision.transactionId });
			} else if (decision.action === "join") {
				joins.push(
					await joined(
						tx,
						householdId,
						access,
						destination,
						line,
						decision,
						field,
						joins,
					),
				);
			} else {
				planned.push(
					await confirmed(
						tx,
						viewer,
						access,
						destination,
						line,
						decision,
						field,
					),
				);
			}
		}
		await assertLinks(tx, householdId, decided, linked);

		for (const part of chunks(planned)) {
			await tx.insert(transactions).values(part.map((each) => each.values));
		}
		const lines = planned.flatMap((each) =>
			each.lines.map((line, position) => ({
				transactionId: each.id,
				householdId,
				position,
				amount: line.amount,
				tagId: line.tagId,
			})),
		);
		for (const part of chunks(lines)) {
			await tx.insert(transactionLines).values(part);
		}
		for (const join of joins) {
			await tx
				.update(transactions)
				.set({ ...join.becomes, type: "transfer", payee: null })
				.where(eq(transactions.id, join.transactionId));
			// A transfer has no lines: its tags were the expense's or the income's
			await tx
				.delete(transactionLines)
				.where(eq(transactionLines.transactionId, join.transactionId));
		}
		for (const each of planned) {
			if (each.occurrenceId) {
				await tx
					.update(recurringOccurrences)
					.set({ status: "recorded", transactionId: each.id })
					.where(eq(recurringOccurrences.id, each.occurrenceId));
			}
		}
		const statementRows = [
			...planned.flatMap((each) =>
				each.sources.map((source) => ({
					...source,
					transactionId: each.id,
					kind: each.kind,
				})),
			),
			...linked.map((each) => ({ ...each, kind: "linked" as const })),
			...joins.map(({ accountId, externalId, transactionId, before }) => ({
				accountId,
				externalId,
				transactionId,
				kind: "joined" as const,
				joinedBefore: before,
			})),
		].map((row) => ({ ...row, householdId, importId: created.id }));
		for (const part of chunks(statementRows)) {
			await tx.insert(statementLines).values(part);
		}
		await rememberAccounts(tx, householdId, destinations);
		const openings = await followOpenings(tx, plan, destinations, created.id);
		if (openings.length > 0) {
			await tx
				.update(statementImports)
				.set({ openingBalances: openings })
				.where(eq(statementImports.id, created.id));
		}

		if (statementRows.length > 0) {
			await publishHouseholdEvent(tx, householdId, "transactions");
		}
		if (
			openings.length > 0 ||
			plan.accounts.some((account) => "create" in account.target)
		) {
			await publishHouseholdEvent(tx, householdId, "accounts");
		}
		if (planned.some((each) => each.occurrenceId)) {
			await publishHouseholdEvent(tx, householdId, "recurring");
		}
		const [summary] = await summaries(tx, [created.id]);
		if (!summary) {
			throw new Error("The import was not recorded");
		}
		return summary;
	});
}

/**
 * Each account of the plan, in the file, and the household's account it
 * goes to: one the member holds, still open, or a new one made for it. Two
 * accounts of the file never go to the same one.
 */
async function resolveDestinations(
	tx: Tx,
	viewer: Viewer,
	access: Map<string, AccountAccess>,
	plan: StatementImportPlan,
	found: StatementAccount[],
): Promise<Destination[]> {
	const destinations: Destination[] = [];
	for (const [at, planned] of plan.accounts.entries()) {
		const field = `accounts.${at}`;
		const statementAccount = found[planned.index];
		if (!statementAccount) {
			throw invalid(`${field}.index`, "import_targets_invalid");
		}
		let accountId: string;
		if ("create" in planned.target) {
			({ id: accountId } = await insertAccount(
				tx,
				viewer,
				planned.target.create,
			));
			// Its maker holds it: the access read before doesn't know it yet
			access.set(accountId, {
				isHolder: true,
				seesDetails: true,
				archived: false,
			});
		} else {
			accountId = planned.target.accountId;
			const rights = access.get(accountId);
			if (!rights?.isHolder || rights.archived) {
				throw invalid(`${field}.target`, "import_account_invalid");
			}
		}
		if (destinations.some((each) => each.accountId === accountId)) {
			throw invalid(`${field}.target`, "import_targets_invalid");
		}
		destinations.push({
			index: planned.index,
			statementAccount,
			accountId,
			field,
		});
	}
	return destinations;
}

/** A line decided, with its line on the statement and where it goes. */
interface Decided {
	decision: StatementLineDecision;
	line: StatementLine;
	destination: Destination;
	field: string;
	/** For a transfer with its other side in the file: that line, and where it goes. */
	pair?: { line: StatementLine; destination: Destination };
}

/**
 * Every decision with its line: the line is in the file, decided once, and
 * the other side of a transfer named as its `pair` gets no decision of its
 * own.
 */
function decisionsOf(
	plan: StatementImportPlan,
	destinations: Destination[],
): Decided[] {
	const decided: Decided[] = [];
	const seen = new Set<string>();
	for (const [at, planned] of plan.accounts.entries()) {
		const destination = destinations[at];
		if (!destination) {
			continue;
		}
		const byId = new Map(
			destination.statementAccount.lines.map((line) => [line.externalId, line]),
		);
		for (const [lineAt, decision] of planned.lines.entries()) {
			const field = `${destination.field}.lines.${lineAt}`;
			const line = byId.get(decision.externalId);
			const key = `${destination.index}:${decision.externalId}`;
			if (!line || seen.has(key)) {
				throw invalid(`${field}.externalId`, "statement_line_invalid");
			}
			seen.add(key);
			let pair: Decided["pair"];
			if (decision.action === "transfer" && decision.pair) {
				const other = destinations.find(
					(each) => each.index === decision.pair?.index,
				);
				const otherLine = other?.statementAccount.lines.find(
					(each) => each.externalId === decision.pair?.externalId,
				);
				const pairKey = `${decision.pair.index}:${decision.pair.externalId}`;
				if (
					!other ||
					!otherLine ||
					other === destination ||
					otherLine.amount !== -line.amount ||
					seen.has(pairKey)
				) {
					throw invalid(`${field}.pair`, "import_transfer_invalid");
				}
				seen.add(pairKey);
				pair = { line: otherLine, destination: other };
			}
			decided.push({ decision, line, destination, field, pair });
		}
	}
	return decided;
}

/** None of the lines decided was imported into its account before. */
async function assertNotImported(
	tx: Tx,
	decided: Decided[],
	destinations: Destination[],
): Promise<void> {
	for (const destination of destinations) {
		const ids = decided.flatMap((each) => [
			...(each.destination === destination ? [each.line.externalId] : []),
			...(each.pair?.destination === destination
				? [each.pair.line.externalId]
				: []),
		]);
		if (ids.length === 0) {
			continue;
		}
		const [already] = await tx
			.select({ externalId: statementLines.externalId })
			.from(statementLines)
			.where(
				and(
					eq(statementLines.accountId, destination.accountId),
					inArray(statementLines.externalId, ids),
				),
			)
			.limit(1);
		if (already) {
			throw new AppError(
				409,
				"statement_line_already_imported",
				"A line of this statement was already imported into the account",
			);
		}
	}
}

/** The tags of the lines created are tags of the household. */
async function assertTags(
	tx: Tx,
	householdId: string,
	decided: Decided[],
): Promise<void> {
	const wanted = decided.flatMap(({ decision, field }) =>
		decision.action === "create" && decision.tagId
			? [{ tagId: decision.tagId, field }]
			: [],
	);
	if (wanted.length === 0) {
		return;
	}
	const known = new Set(
		(
			await tx
				.select({ id: tags.id })
				.from(tags)
				.where(
					and(
						eq(tags.householdId, householdId),
						inArray(
							tags.id,
							wanted.map((each) => each.tagId),
						),
					),
				)
		).map((tag) => tag.id),
	);
	const unknown = wanted.find((each) => !known.has(each.tagId));
	if (unknown) {
		throw invalid(`${unknown.field}.tagId`, "transaction_tag_invalid");
	}
}

/** An expense or an income, the way the money went on the statement. */
function expenseOrIncome(
	viewer: Viewer,
	destination: Destination,
	line: StatementLine,
	decision: Extract<StatementLineDecision, { action: "create" }>,
	source: { accountId: string; externalId: string },
): Planned {
	const id = randomUUID();
	const amount = Math.abs(line.amount);
	return {
		id,
		values: {
			id,
			householdId: viewer.membership.household.id,
			type: line.amount < 0 ? "expense" : "income",
			date: line.date,
			accountId: destination.accountId,
			amount,
			payee:
				(decision.payee || line.payee).slice(0, TRANSACTION_PAYEE_MAX_LENGTH) ||
				null,
			note: decision.note || null,
			origin: "import",
			createdBy: viewer.userId,
		},
		lines: [{ amount, tagId: decision.tagId ?? null }],
		sources: [source],
		kind: "created",
	};
}

/**
 * A transfer with another account: from the line's account when the money
 * left it, into it when it came in. The member holds the account the money
 * leaves, as for any transfer; both are open.
 */
function transfer(
	viewer: Viewer,
	access: Map<string, AccountAccess>,
	{ decision, line, destination, pair }: Decided,
	source: { accountId: string; externalId: string },
	field: string,
): Planned {
	if (decision.action !== "transfer") {
		throw new Error("Not a transfer");
	}
	const other = pair?.destination.accountId ?? decision.accountId;
	if (
		!other ||
		other === destination.accountId ||
		(decision.accountId !== undefined && decision.accountId !== other)
	) {
		throw invalid(`${field}.accountId`, "import_transfer_invalid");
	}
	const [from, to] =
		line.amount < 0
			? [destination.accountId, other]
			: [other, destination.accountId];
	const fromRights = access.get(from);
	const toRights = access.get(to);
	if (
		!fromRights?.isHolder ||
		fromRights.archived ||
		!toRights ||
		toRights.archived
	) {
		throw invalid(`${field}.accountId`, "import_transfer_invalid");
	}
	const id = randomUUID();
	return {
		id,
		values: {
			id,
			householdId: viewer.membership.household.id,
			type: "transfer",
			date: line.amount < 0 || !pair ? line.date : pair.line.date,
			accountId: from,
			toAccountId: to,
			amount: Math.abs(line.amount),
			payee: null,
			note: null,
			origin: "import",
			createdBy: viewer.userId,
		},
		lines: [],
		sources: pair
			? [
					source,
					{
						accountId: pair.destination.accountId,
						externalId: pair.line.externalId,
					},
				]
			: [source],
		kind: "created",
	};
}

/**
 * A recurring day waiting, recorded as its recurring transaction says, on
 * the statement's day: the same amount, on the line's account.
 */
async function confirmed(
	tx: Tx,
	viewer: Viewer,
	access: Map<string, AccountAccess>,
	destination: Destination,
	line: StatementLine,
	decision: Extract<StatementLineDecision, { action: "confirm" }>,
	field: string,
): Promise<Planned> {
	const [row] = await tx
		.select({ occurrence: recurringOccurrences, rule: recurringTransactions })
		.from(recurringOccurrences)
		.innerJoin(
			recurringTransactions,
			eq(recurringTransactions.id, recurringOccurrences.recurringId),
		)
		.where(
			and(
				eq(recurringOccurrences.id, decision.occurrenceId),
				eq(recurringOccurrences.householdId, viewer.membership.household.id),
			),
		)
		.for("update", { of: recurringOccurrences });
	const rule = row?.rule;
	const touches =
		rule &&
		(rule.accountId === destination.accountId ||
			rule.toAccountId === destination.accountId);
	const sourceRights = rule ? access.get(rule.accountId) : undefined;
	if (
		!row ||
		!rule ||
		!touches ||
		!isVisible(rule, access) ||
		row.occurrence.status !== "pending" ||
		signedFor(destination.accountId, rule) !== line.amount ||
		!sourceRights?.isHolder ||
		sourceRights.archived
	) {
		throw invalid(`${field}.occurrenceId`, "import_occurrence_invalid");
	}
	const ruleLines = await tx
		.select({
			amount: recurringTransactionLines.amount,
			tagId: recurringTransactionLines.tagId,
		})
		.from(recurringTransactionLines)
		.where(eq(recurringTransactionLines.recurringId, rule.id))
		.orderBy(recurringTransactionLines.position);
	const id = randomUUID();
	return {
		id,
		values: {
			id,
			householdId: viewer.membership.household.id,
			type: rule.type,
			date: line.date,
			accountId: rule.accountId,
			toAccountId: rule.toAccountId,
			amount: rule.amount,
			payee: rule.payee,
			note: rule.note,
			origin: "recurring",
			createdBy: viewer.userId,
		},
		lines: ruleLines,
		sources: [
			{ accountId: destination.accountId, externalId: line.externalId },
		],
		kind: "confirmed",
		occurrenceId: row.occurrence.id,
	};
}

/**
 * Each transaction a line is tied to: in the household, on the line's
 * account, of the same amount the same way, tied to no other line of that
 * account's statements, and once.
 */
async function assertLinks(
	tx: Tx,
	householdId: string,
	decided: Decided[],
	linked: { accountId: string; externalId: string; transactionId: string }[],
): Promise<void> {
	if (linked.length === 0) {
		return;
	}
	const ids = linked.map((each) => each.transactionId);
	const [rows, tied] = await Promise.all([
		tx
			.select({
				id: transactions.id,
				type: transactions.type,
				accountId: transactions.accountId,
				toAccountId: transactions.toAccountId,
				amount: transactions.amount,
			})
			.from(transactions)
			.where(
				and(
					eq(transactions.householdId, householdId),
					inArray(transactions.id, ids),
				),
			),
		tx
			.select({
				accountId: statementLines.accountId,
				transactionId: statementLines.transactionId,
			})
			.from(statementLines)
			.where(inArray(statementLines.transactionId, ids)),
	]);
	const byId = new Map(rows.map((row) => [row.id, row]));
	const used = new Set(
		tied.map((each) => `${each.accountId}:${each.transactionId}`),
	);
	for (const link of linked) {
		const row = byId.get(link.transactionId);
		const each = decided.find(
			(one) =>
				one.destination.accountId === link.accountId &&
				one.line.externalId === link.externalId,
		);
		const key = `${link.accountId}:${link.transactionId}`;
		if (
			!row ||
			!each ||
			(row.accountId !== link.accountId &&
				row.toAccountId !== link.accountId) ||
			signedFor(link.accountId, row) !== each.line.amount ||
			used.has(key)
		) {
			throw invalid(
				`${each?.field ?? "accounts"}.transactionId`,
				"import_link_invalid",
			);
		}
		used.add(key);
	}
}

/** The statement's accounts, tied to where they went, for the next imports. */
async function rememberAccounts(
	tx: Tx,
	householdId: string,
	destinations: Destination[],
): Promise<void> {
	for (const { statementAccount, accountId } of destinations) {
		await tx
			.insert(statementAccounts)
			.values({
				householdId,
				accountId,
				numberHash: hashStatementNumber(statementAccount.number),
				bankName: statementAccount.bankName,
				numberEnd: statementAccount.numberEnd,
			})
			.onConflictDoUpdate({
				target: [statementAccounts.householdId, statementAccounts.numberHash],
				set: {
					accountId,
					bankName: statementAccount.bankName,
					numberEnd: statementAccount.numberEnd,
				},
			});
	}
}

/** An entry of another account that becomes the transfer a line is. */
interface Join {
	/** The line's account, and the line. */
	accountId: string;
	externalId: string;
	transactionId: string;
	/** The transfer's accounts: from the one the money leaves. */
	becomes: { accountId: string; toAccountId: string };
	before: JoinedBefore;
}

/**
 * The other side of a transfer, entered in another account as an expense
 * or an income: the same amount the other way, not shared, on an account
 * the member holds (they change its entry), as the line's; once.
 */
async function joined(
	tx: Tx,
	householdId: string,
	access: Map<string, AccountAccess>,
	destination: Destination,
	line: StatementLine,
	decision: Extract<StatementLineDecision, { action: "join" }>,
	field: string,
	joins: Join[],
): Promise<Join> {
	const [row] = await tx
		.select()
		.from(transactions)
		.where(
			and(
				eq(transactions.id, decision.transactionId),
				eq(transactions.householdId, householdId),
			),
		)
		.for("update");
	const other = row?.accountId;
	const [from, to] =
		line.amount < 0
			? [destination.accountId, other]
			: [other, destination.accountId];
	const fromRights = from ? access.get(from) : undefined;
	const otherRights = other ? access.get(other) : undefined;
	if (
		!row ||
		!other ||
		!to ||
		!from ||
		(row.type !== "expense" && row.type !== "income") ||
		other === destination.accountId ||
		row.sharePaidBy !== null ||
		// The other way round: what left one account came into the other
		(row.type === "expense" ? row.amount : -row.amount) !== line.amount ||
		// Changing an entry of an account is for its holders
		!otherRights?.isHolder ||
		otherRights.archived ||
		!fromRights?.isHolder ||
		joins.some((each) => each.transactionId === row.id)
	) {
		throw invalid(`${field}.transactionId`, "import_join_invalid");
	}
	const lines = await tx
		.select({ amount: transactionLines.amount, tagId: transactionLines.tagId })
		.from(transactionLines)
		.where(eq(transactionLines.transactionId, row.id))
		.orderBy(transactionLines.position);
	return {
		accountId: destination.accountId,
		externalId: line.externalId,
		transactionId: row.id,
		becomes: { accountId: from, toAccountId: to },
		before: {
			type: row.type,
			accountId: row.accountId,
			payee: row.payee,
			lines,
		},
	};
}

/**
 * The opening balances that follow the statements: an account the file
 * goes further back than anything else in it (the import's own lines left
 * aside) starts at the file's opening balance. An account made from the
 * file already does.
 */
async function followOpenings(
	tx: Tx,
	plan: StatementImportPlan,
	destinations: Destination[],
	importId: string,
): Promise<OpeningChange[]> {
	const changes: OpeningChange[] = [];
	for (const [at, destination] of destinations.entries()) {
		const opening = destination.statementAccount.openingBalance;
		const first = destination.statementAccount.lines[0]?.date;
		if (
			opening === null ||
			!first ||
			"create" in (plan.accounts[at]?.target ?? {})
		) {
			continue;
		}
		const { accountId } = destination;
		const [earlier] = await tx
			.select({ id: transactions.id })
			.from(transactions)
			.where(
				and(
					or(
						eq(transactions.accountId, accountId),
						eq(transactions.toAccountId, accountId),
					),
					lt(transactions.date, first),
					notInArray(
						transactions.id,
						tx
							.select({ id: statementLines.transactionId })
							.from(statementLines)
							.where(eq(statementLines.importId, importId)),
					),
				),
			)
			.limit(1);
		if (earlier) {
			continue;
		}
		const [account] = await tx
			.select({ openingBalance: ledgerAccounts.openingBalance })
			.from(ledgerAccounts)
			.where(eq(ledgerAccounts.id, accountId))
			.for("update");
		if (account && account.openingBalance !== opening) {
			await tx
				.update(ledgerAccounts)
				.set({ openingBalance: opening })
				.where(eq(ledgerAccounts.id, accountId));
			changes.push({
				accountId,
				before: account.openingBalance,
				after: opening,
			});
		}
	}
	return changes;
}

/** Imports as the API shows them: who, when, and what each did account by account. */
async function summaries(
	database: typeof db | Tx,
	importIds: string[],
): Promise<StatementImport[]> {
	if (importIds.length === 0) {
		return [];
	}
	const [rows, counts] = await Promise.all([
		database
			.select({
				id: statementImports.id,
				format: statementImports.format,
				openingBalances: statementImports.openingBalances,
				createdAt: statementImports.createdAt,
				userId: users.id,
				name: users.name,
				email: users.email,
			})
			.from(statementImports)
			.leftJoin(users, eq(users.id, statementImports.createdBy))
			.where(inArray(statementImports.id, importIds))
			.orderBy(desc(statementImports.createdAt)),
		database
			.select({
				importId: statementLines.importId,
				accountId: statementLines.accountId,
				kind: statementLines.kind,
				total: count(),
			})
			.from(statementLines)
			.where(inArray(statementLines.importId, importIds))
			.groupBy(
				statementLines.importId,
				statementLines.accountId,
				statementLines.kind,
			),
	]);
	return rows.map((row) => {
		const accounts = new Map<string, StatementImport["accounts"][number]>();
		const accountOf = (accountId: string) => {
			const account = accounts.get(accountId) ?? {
				accountId,
				created: 0,
				linked: 0,
				confirmed: 0,
				joined: 0,
				openingBalance: null,
			};
			accounts.set(accountId, account);
			return account;
		};
		for (const each of counts) {
			if (each.importId === row.id) {
				accountOf(each.accountId)[each.kind] += each.total;
			}
		}
		for (const opening of row.openingBalances) {
			accountOf(opening.accountId).openingBalance = opening.after;
		}
		return {
			id: row.id,
			format: row.format,
			createdAt: row.createdAt.toISOString(),
			createdBy: row.userId
				? { userId: row.userId, name: row.name || row.email || "" }
				: null,
			accounts: [...accounts.values()],
		};
	});
}

/** The member's own imports, the most recent first: those they can undo. */
export async function listImports(
	viewer: Viewer,
	pagination: PaginationQuery,
): Promise<Paginated<StatementImport>> {
	const where = and(
		eq(statementImports.householdId, viewer.membership.household.id),
		eq(statementImports.createdBy, viewer.userId),
	);
	const [rows, [counted]] = await Promise.all([
		db
			.select({ id: statementImports.id })
			.from(statementImports)
			.where(where)
			.orderBy(desc(statementImports.createdAt))
			.limit(pagination.pageSize)
			.offset(offsetOf(pagination)),
		db.select({ total: count() }).from(statementImports).where(where),
	]);
	return {
		data: await summaries(
			db,
			rows.map((row) => row.id),
		),
		pagination: { ...pagination, total: counted?.total ?? 0 },
	};
}

/**
 * Undoes an import, by the member who made it: the transactions it created
 * are deleted (whatever was changed in them since), the recurring days it
 * recorded wait again, the transactions it tied to lines stay as they were.
 * The accounts it made stay, empty, to delete by hand.
 */
export async function undoImport(
	viewer: Viewer,
	importId: string,
): Promise<void> {
	const householdId = viewer.membership.household.id;
	await db.transaction(async (tx) => {
		const [row] = await tx
			.select()
			.from(statementImports)
			.where(
				and(
					eq(statementImports.id, importId),
					eq(statementImports.householdId, householdId),
				),
			)
			.for("update");
		if (!row || row.createdBy !== viewer.userId) {
			throw new AppError(404, "not_found", "Import not found");
		}
		const made = await tx
			.selectDistinct({
				id: transactions.id,
				accountId: transactions.accountId,
			})
			.from(statementLines)
			.innerJoin(
				transactions,
				eq(transactions.id, statementLines.transactionId),
			)
			.where(
				and(
					eq(statementLines.importId, importId),
					inArray(statementLines.kind, ["created", "confirmed"]),
				),
			);
		const access = await accountAccess(tx, viewer);
		if (made.some((each) => !access.get(each.accountId)?.isHolder)) {
			throw new AppError(
				403,
				"forbidden",
				"Only a holder of their accounts can delete these transactions",
			);
		}
		const ids = made.map((each) => each.id);
		// The transfers it made of entries in another account: back as they were
		const joins = await tx
			.select({
				transactionId: statementLines.transactionId,
				before: statementLines.joinedBefore,
			})
			.from(statementLines)
			.where(
				and(
					eq(statementLines.importId, importId),
					eq(statementLines.kind, "joined"),
				),
			);
		for (const { transactionId, before } of joins) {
			if (!before) {
				continue;
			}
			await tx
				.update(transactions)
				.set({
					type: before.type,
					accountId: before.accountId,
					toAccountId: null,
					payee: before.payee,
				})
				.where(eq(transactions.id, transactionId));
			if (before.lines.length > 0) {
				await tx.insert(transactionLines).values(
					before.lines.map((line, position) => ({
						transactionId,
						householdId,
						position,
						amount: line.amount,
						tagId: line.tagId,
					})),
				);
			}
		}
		for (const { accountId, before } of row.openingBalances) {
			await tx
				.update(ledgerAccounts)
				.set({ openingBalance: before })
				.where(
					and(
						eq(ledgerAccounts.id, accountId),
						eq(ledgerAccounts.householdId, householdId),
					),
				);
		}
		let recurring = false;
		if (ids.length > 0) {
			const waiting = await tx
				.update(recurringOccurrences)
				.set({ status: "pending", transactionId: null })
				.where(inArray(recurringOccurrences.transactionId, ids))
				.returning({ id: recurringOccurrences.id });
			recurring = waiting.length > 0;
			for (const part of chunks(ids)) {
				await tx.delete(transactions).where(inArray(transactions.id, part));
			}
		}
		// The lines tied to transactions already there go with the import
		await tx.delete(statementImports).where(eq(statementImports.id, importId));
		await publishHouseholdEvent(tx, householdId, "transactions");
		if (row.openingBalances.length > 0) {
			await publishHouseholdEvent(tx, householdId, "accounts");
		}
		if (recurring) {
			await publishHouseholdEvent(tx, householdId, "recurring");
		}
	});
}
