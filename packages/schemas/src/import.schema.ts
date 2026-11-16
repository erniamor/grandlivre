import { z } from "zod";
import { accountTypeSchema } from "./account.schema";
import { calendarDateSchema } from "./common";
import { transactionTypeSchema } from "./transaction.schema";

/** The largest statement file taken, in bytes. */
export const STATEMENT_MAX_BYTES = 1024 * 1024;

/** The most accounts a statement file may name, each sent somewhere. */
export const STATEMENT_MAX_ACCOUNTS = 20;

/** The statement formats read. */
export const STATEMENT_FORMATS = [
	"desjardins_accounts",
	"desjardins_cards",
] as const;

/**
 * Where a statement line stands:
 * - "new": nothing in the account is it yet;
 * - "imported": an import already brought it in;
 * - "matched": a transaction of the account looks like it (same amount,
 *   a close day): it will be tied to it rather than recorded again;
 * - "recurring": a recurring transaction's day waits for it.
 */
export const STATEMENT_LINE_STATUSES = [
	"new",
	"imported",
	"matched",
	"recurring",
] as const;

/**
 * Which account of the household each account of the file goes to, by its
 * place in the file; the accounts recognized from an earlier import go to
 * theirs unless told otherwise.
 */
export const statementTargetsSchema = z
	.array(
		z.strictObject({
			index: z
				.number()
				.int()
				.min(0)
				.max(STATEMENT_MAX_ACCOUNTS - 1),
			accountId: z.uuid("import_account_invalid"),
		}),
		"import_targets_invalid",
	)
	.max(STATEMENT_MAX_ACCOUNTS, "import_targets_invalid")
	.refine(
		(targets) =>
			new Set(targets.map((target) => target.index)).size === targets.length,
		"import_targets_invalid",
	);

export type StatementTargets = z.infer<typeof statementTargetsSchema>;

/** What a new line could be: an expense or an income on a tag, or a transfer. */
export const statementSuggestionSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("tag"), tagId: z.uuid() }),
	/** The money went to, or came from, this other account. */
	z.object({ kind: z.literal("transfer"), accountId: z.uuid() }),
]);

export type StatementSuggestion = z.infer<typeof statementSuggestionSchema>;

export const statementPreviewLineSchema = z.object({
	/** The line's identity in the account's statements. */
	externalId: z.string(),
	date: calendarDateSchema,
	/** In minor units: positive in, negative out. */
	amount: z.number().int(),
	description: z.string(),
	payee: z.string(),
	status: z.enum(STATEMENT_LINE_STATUSES),
	/** "imported" or "matched": the transaction it is, or looks like. */
	match: z
		.object({
			transactionId: z.uuid(),
			type: transactionTypeSchema,
			date: calendarDateSchema,
			payee: z.string().nullable(),
		})
		.nullable(),
	/** "recurring": the day waiting for it. */
	occurrence: z
		.object({
			recurringId: z.uuid(),
			date: calendarDateSchema,
			payee: z.string().nullable(),
		})
		.nullable(),
	/** "new": what it most likely is; null when nothing tells. */
	suggestion: statementSuggestionSchema.nullable(),
	/**
	 * "new": the same transfer seen from another account of the file, by its
	 * place and its line: both make one transfer.
	 */
	pair: z
		.object({ index: z.number().int(), externalId: z.string() })
		.nullable(),
});

export type StatementPreviewLine = z.infer<typeof statementPreviewLineSchema>;

export const statementPreviewAccountSchema = z.object({
	/** Its place in the file. */
	index: z.number().int(),
	/** The bank's name for it (a branch, a card), and its number's last digits. */
	bankName: z.string(),
	numberEnd: z.string(),
	/** The kind of account it looks like, for a new one. */
	type: accountTypeSchema,
	/**
	 * Its balance before the first line and after the last, in minor units,
	 * negative for money owed; null when the file doesn't say (cards).
	 */
	openingBalance: z.number().int().nullable(),
	closingBalance: z.number().int().nullable(),
	from: calendarDateSchema,
	to: calendarDateSchema,
	/** The household's account it goes to; null until one is chosen or made. */
	accountId: z.uuid().nullable(),
	/** It goes there because an earlier import tied it to it. */
	recognized: z.boolean(),
	/**
	 * The member holds that account and may import into it: otherwise its
	 * lines are only read, never compared with its transactions.
	 */
	writable: z.boolean(),
	lines: z.array(statementPreviewLineSchema),
});

export type StatementPreviewAccount = z.infer<
	typeof statementPreviewAccountSchema
>;

/** A statement file read, before anything is imported. */
export const statementPreviewSchema = z.object({
	format: z.enum(STATEMENT_FORMATS),
	accounts: z.array(statementPreviewAccountSchema),
});

export type StatementPreview = z.infer<typeof statementPreviewSchema>;
