import { z } from "zod";
import { amountSchema, calendarDateSchema, dateTimeSchema } from "./common";

/**
 * - "expense": money leaves the account;
 * - "income": money enters the account;
 * - "transfer": money moves from the account to another account of the
 *   household: neither an expense nor an income.
 */
export const TRANSACTION_TYPES = ["expense", "income", "transfer"] as const;

/** How a transaction was recorded. */
export const TRANSACTION_ORIGINS = [
	"manual",
	"voice",
	"receipt",
	"import",
] as const;

export const TRANSACTION_PAYEE_MAX_LENGTH = 80;
export const TRANSACTION_NOTE_MAX_LENGTH = 500;
export const TRANSACTION_EXTERNAL_ID_MAX_LENGTH = 200;

/** Lines an expense or an income can be split into. */
export const TRANSACTION_MAX_LINES = 50;

export const transactionTypeSchema = z.enum(
	TRANSACTION_TYPES,
	"transaction_type_invalid",
);

export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const transactionOriginSchema = z.enum(TRANSACTION_ORIGINS);

export type TransactionOrigin = z.infer<typeof transactionOriginSchema>;

// Error messages are codes, translated by the front ends.

/**
 * The amount of a transaction or of one of its lines, in minor units: always
 * positive, the type of the transaction says which way the money goes.
 */
export const transactionAmountSchema = amountSchema.min(
	1,
	"amount_not_positive",
);

// trim(): a text made only of spaces counts as empty
const payeeSchema = z
	.string()
	.trim()
	.max(TRANSACTION_PAYEE_MAX_LENGTH, "transaction_payee_too_long")
	.nullable();

const noteSchema = z
	.string()
	.trim()
	.max(TRANSACTION_NOTE_MAX_LENGTH, "transaction_note_too_long")
	.nullable();

/**
 * One part of an expense or an income: an amount and at most one tag, so
 * that reports never count an amount twice.
 */
export const transactionLineInputSchema = z.strictObject({
	amount: transactionAmountSchema,
	/** A tag of the household; null or missing for an uncategorized line. */
	tagId: z.uuid("transaction_tag_invalid").nullable().optional(),
});

export type TransactionLineInput = z.infer<typeof transactionLineInputSchema>;

const commonFields = {
	/** The account the money leaves (expense, transfer) or enters (income). */
	accountId: z.uuid("transaction_account_invalid"),
	/** The day of the transaction, as written on a statement or a receipt. */
	date: calendarDateSchema,
	note: noteSchema.optional(),
};

/** The merchant or the person paid, or who paid; one line or more. */
const splitFields = {
	...commonFields,
	payee: payeeSchema.optional(),
	/** Their sum is the amount of the transaction. */
	lines: z
		.array(transactionLineInputSchema, "transaction_lines_required")
		.min(1, "transaction_lines_required")
		.max(TRANSACTION_MAX_LINES, "transaction_lines_too_many"),
};

const expenseInputSchema = z.strictObject({
	type: z.literal("expense"),
	...splitFields,
});

const incomeInputSchema = z.strictObject({
	type: z.literal("income"),
	...splitFields,
});

const transferInputSchema = z.strictObject({
	type: z.literal("transfer"),
	...commonFields,
	/** The account the money enters: another account of the household. */
	toAccountId: z.uuid("transaction_account_invalid"),
	amount: transactionAmountSchema,
});

/**
 * What a transaction is made of, and what changing one sends: the whole
 * transaction, which replaces the previous one.
 */
export const updateTransactionSchema = z
	.discriminatedUnion(
		"type",
		[expenseInputSchema, incomeInputSchema, transferInputSchema],
		"transaction_type_invalid",
	)
	.refine(
		(input) =>
			input.type !== "transfer" || input.accountId !== input.toAccountId,
		{ message: "transfer_same_account", path: ["toAccountId"] },
	);

export type UpdateTransaction = z.infer<typeof updateTransactionSchema>;

/** Where the transaction comes from; a plain form sends neither field. */
const originFields = {
	/** "manual" when missing. */
	origin: transactionOriginSchema.optional(),
	/**
	 * Identifier of the transaction in the statement it was imported from:
	 * the same one is never imported twice into an account.
	 */
	externalId: z
		.string()
		.trim()
		.min(1)
		.max(TRANSACTION_EXTERNAL_ID_MAX_LENGTH)
		.optional(),
};

export const createTransactionSchema = z
	.discriminatedUnion(
		"type",
		[
			expenseInputSchema.extend(originFields),
			incomeInputSchema.extend(originFields),
			transferInputSchema.extend(originFields),
		],
		"transaction_type_invalid",
	)
	.refine(
		(input) =>
			input.type !== "transfer" || input.accountId !== input.toAccountId,
		{ message: "transfer_same_account", path: ["toAccountId"] },
	);

export type CreateTransaction = z.infer<typeof createTransactionSchema>;

export const transactionLineSchema = z.object({
	id: z.uuid(),
	amount: z.number().int(),
	/** Null for an uncategorized line. */
	tagId: z.uuid().nullable(),
});

export type TransactionLine = z.infer<typeof transactionLineSchema>;

/** A transaction, as seen by a member who may see the details of its account. */
export const transactionSchema = z.object({
	id: z.uuid(),
	householdId: z.uuid(),
	type: transactionTypeSchema,
	date: calendarDateSchema,
	accountId: z.uuid(),
	/** The account the money enters, for a transfer; null otherwise. */
	toAccountId: z.uuid().nullable(),
	/** Positive, in minor units: for an expense or an income, the sum of its lines. */
	amount: z.number().int(),
	payee: z.string().nullable(),
	note: z.string().nullable(),
	origin: transactionOriginSchema,
	/** In the order they were entered; empty for a transfer. */
	lines: z.array(transactionLineSchema),
	/** Who recorded it; null once they left the product. */
	createdBy: z
		.object({
			userId: z.uuid(),
			/** Their name, or their email until they choose one. */
			name: z.string(),
		})
		.nullable(),
	createdAt: dateTimeSchema,
	updatedAt: dateTimeSchema,
});

export type Transaction = z.infer<typeof transactionSchema>;
