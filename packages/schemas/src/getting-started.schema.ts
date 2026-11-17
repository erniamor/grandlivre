import { z } from "zod";
import { calendarDateSchema } from "./common";

/**
 * The steps of a household starting out, in order: tags chosen, accounts
 * made (from a statement, best), a wallet, the other members invited, the
 * history imported then categorized, recurring transactions and budgets.
 */
export const GETTING_STARTED_STEPS = [
	"tags",
	"accounts",
	"wallet",
	"members",
	"imported",
	"categorized",
	"recurring",
	"budgets",
] as const;

export type GettingStartedStep = (typeof GETTING_STARTED_STEPS)[number];

/**
 * Where a household stands in its first steps, as the member sees it:
 * computed from its data each time, never stored; only whether the member
 * hid it is kept.
 */
export const gettingStartedSchema = z.object({
	/** The member put it away: the dashboard no longer shows it. */
	hidden: z.boolean(),
	/** Each step, done or not. */
	steps: z.object({
		/** The household has tags. */
		tags: z.boolean(),
		/** The household has an account still open. */
		accounts: z.boolean(),
		/** The member holds a cash account, still open. */
		wallet: z.boolean(),
		/** Another member joined, or was invited. */
		members: z.boolean(),
		/** A statement was imported into the household. */
		imported: z.boolean(),
		/** No expense nor income of the member's accounts is left without a tag. */
		categorized: z.boolean(),
		/** The household has a recurring transaction. */
		recurring: z.boolean(),
		/** The household has a budget. */
		budgets: z.boolean(),
	}),
	/** The expenses and incomes of the member's accounts without a tag. */
	uncategorized: z.number().int(),
});

export type GettingStarted = z.infer<typeof gettingStartedSchema>;

export const updateGettingStartedSchema = z.strictObject({
	hidden: z.boolean(),
});

export type UpdateGettingStarted = z.infer<typeof updateGettingStartedSchema>;

/** The two kinds of transaction a tag goes on. */
export const categorizableTypeSchema = z.enum(
	["expense", "income"],
	"transaction_type_invalid",
);

/**
 * The expenses (or incomes) without a tag of one payee, on the member's
 * accounts: payees alike in their letters are one ("COSTCO ESSENCE W100"
 * and "COSTCO ESSENCE W1234").
 */
export const uncategorizedPayeeSchema = z.object({
	/** What tells the payee: its letters, without accents nor case. */
	key: z.string(),
	/** The payee as most of its transactions write it. */
	payee: z.string(),
	type: categorizableTypeSchema,
	count: z.number().int(),
	/** In minor units, positive: what went out (expenses) or came in (incomes). */
	total: z.number().int(),
	firstDate: calendarDateSchema,
	lastDate: calendarDateSchema,
});

export type UncategorizedPayee = z.infer<typeof uncategorizedPayeeSchema>;

/** A tag for every expense (or income) without one of a payee. */
export const categorizePayeeSchema = z.strictObject({
	key: z.string().min(1, "payee_key_invalid").max(200, "payee_key_invalid"),
	type: categorizableTypeSchema,
	tagId: z.uuid("transaction_tag_invalid"),
});

export type CategorizePayee = z.infer<typeof categorizePayeeSchema>;

export const categorizeResultSchema = z.object({
	/** How many transactions took the tag. */
	count: z.number().int(),
});

export type CategorizeResult = z.infer<typeof categorizeResultSchema>;

/** The most payees the assistant suggests tags for at once: a page of them. */
export const TAG_SUGGESTION_MAX_PAYEES = 50;

/** The payees, among those without a tag, to suggest a tag for. */
export const suggestPayeeTagsSchema = z.strictObject({
	payees: z
		.array(
			z.strictObject({
				key: z.string().min(1).max(200),
				type: categorizableTypeSchema,
			}),
		)
		.min(1)
		.max(TAG_SUGGESTION_MAX_PAYEES),
});

export type SuggestPayeeTags = z.infer<typeof suggestPayeeTagsSchema>;

/**
 * The assistant's tag for each payee asked that still has transactions
 * without a tag: one of the household's, or null when none fits surely.
 */
export const payeeTagSuggestionsSchema = z.object({
	suggestions: z.array(
		z.object({
			key: z.string(),
			type: categorizableTypeSchema,
			tagId: z.uuid().nullable(),
		}),
	),
});

export type PayeeTagSuggestions = z.infer<typeof payeeTagSuggestionsSchema>;
