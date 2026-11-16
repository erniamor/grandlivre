import { z } from "zod";
import { amountSchema, calendarDateSchema, dateTimeSchema } from "./common";
import { transactionSchema } from "./transaction.schema";

export const ACCOUNT_NAME_MAX_LENGTH = 60;

/** Kinds of account a household keeps. */
export const ACCOUNT_TYPES = [
	"checking",
	"savings",
	"credit_card",
	"cash",
	"loan",
	"other",
] as const;

/**
 * Types whose balance is money owed: the forms ask for the amount due and
 * store it as a negative balance.
 */
export const ACCOUNT_DEBT_TYPES: readonly AccountType[] = [
	"credit_card",
	"loan",
];

/**
 * What the members who don't hold an account see of it: its transactions
 * ("details") or only its balance ("balance"). Holders always see everything.
 */
export const ACCOUNT_VISIBILITIES = ["details", "balance"] as const;

export const ACCOUNT_MAX_HOLDERS = 20;

// Error messages are codes, translated by the front ends.
// trim(): a name made only of spaces counts as empty.
export const accountNameSchema = z
	.string()
	.trim()
	.min(1, "account_name_required")
	.max(ACCOUNT_NAME_MAX_LENGTH, "account_name_too_long");

export const accountTypeSchema = z.enum(ACCOUNT_TYPES, "account_type_invalid");

export type AccountType = z.infer<typeof accountTypeSchema>;

export const accountVisibilitySchema = z.enum(
	ACCOUNT_VISIBILITIES,
	"account_visibility_invalid",
);

export type AccountVisibility = z.infer<typeof accountVisibilitySchema>;

/** Users who hold an account: one for a personal account, several for a shared one. */
export const accountHolderIdsSchema = z
	.array(z.uuid("account_holders_invalid"), "account_holders_invalid")
	.min(1, "account_holders_required")
	.max(ACCOUNT_MAX_HOLDERS, "account_holders_invalid")
	.refine((ids) => new Set(ids).size === ids.length, "account_holders_invalid");

const accountFields = {
	name: accountNameSchema,
	type: accountTypeSchema,
	visibility: accountVisibilitySchema,
	/** Balance before the first transaction, negative for money owed. */
	openingBalance: amountSchema,
	/** Members of the household. */
	holderIds: accountHolderIdsSchema,
};

/** Without `holderIds`, the account is held by the user who creates it. */
export const createAccountSchema = z.strictObject({
	...accountFields,
	holderIds: accountHolderIdsSchema.optional(),
});

export type CreateAccount = z.infer<typeof createAccountSchema>;

/**
 * Every field is optional: only the ones sent are changed. `archived` puts
 * the account aside: it keeps its transactions and still counts in the
 * household's balance, but takes no new transaction.
 */
export const updateAccountSchema = z
	.strictObject({ ...accountFields, archived: z.boolean() })
	.partial();

export type UpdateAccount = z.infer<typeof updateAccountSchema>;

export const accountHolderSchema = z.object({
	userId: z.uuid(),
	/** The member's name, or their email until they choose one. */
	name: z.string(),
});

export type AccountHolder = z.infer<typeof accountHolderSchema>;

/** An account, as seen by a member of its household. */
export const accountSchema = z.object({
	id: z.uuid(),
	householdId: z.uuid(),
	name: z.string(),
	type: accountTypeSchema,
	visibility: accountVisibilitySchema,
	/** Current balance in minor units: the opening balance plus the transactions. */
	balance: z.number().int(),
	/** Null for a member who only sees the balance of the account. */
	openingBalance: z.number().int().nullable(),
	/** Empty when the last holder left the household. */
	holders: z.array(accountHolderSchema),
	/** The signed-in user holds the account: they can change it. */
	isHolder: z.boolean(),
	/** Put aside: it takes no new transaction. */
	archived: z.boolean(),
	createdAt: dateTimeSchema,
});

export type Account = z.infer<typeof accountSchema>;

/** The household's consolidated view over all its accounts, in minor units. */
export const accountsSummarySchema = z.object({
	/** Sum of the positive balances. */
	assets: z.number().int(),
	/** Sum of the negative balances: zero or negative. */
	liabilities: z.number().int(),
	/** Net balance: assets plus liabilities. */
	balance: z.number().int(),
});

export type AccountsSummary = z.infer<typeof accountsSummarySchema>;

/**
 * What an account really holds on a day (the cash counted in a wallet, the
 * balance a bank shows), in minor units, negative for money owed. The gap
 * with its balance in the app is recorded as an adjustment: an expense when
 * it holds less, an income when it holds more.
 */
export const adjustAccountSchema = z.strictObject({
	balance: amountSchema,
	date: calendarDateSchema,
	/** The tag of the adjustment; uncategorized when missing. */
	tagId: z.uuid("transaction_tag_invalid").nullable().optional(),
});

export type AdjustAccount = z.infer<typeof adjustAccountSchema>;

/** An account adjusted: the adjustment recorded, if there was a gap, and its new balance. */
export const adjustAccountResultSchema = z.object({
	adjustment: transactionSchema.nullable(),
	balance: z.number().int(),
});

export type AdjustAccountResult = z.infer<typeof adjustAccountResultSchema>;
