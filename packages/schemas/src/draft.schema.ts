import { z } from "zod";
import { calendarDateSchema } from "./common";
import { receiptSchema } from "./receipt.schema";
import { transactionTypeSchema } from "./transaction.schema";

export const DRAFT_TEXT_MAX_LENGTH = 500;

/** A note typed or dictated by a member: "gas 72 $", "restaurant 85.40 yesterday". */
export const createDraftSchema = z.strictObject({
	// trim(): a note made only of spaces counts as empty
	text: z
		.string()
		.trim()
		.min(1, "draft_text_required")
		.max(DRAFT_TEXT_MAX_LENGTH, "draft_text_too_long"),
	/**
	 * Today on the member's device: their day, which the server can't know,
	 * to read "yesterday" or "last Friday".
	 */
	today: calendarDateSchema,
});

export type CreateDraft = z.infer<typeof createDraftSchema>;

/**
 * - "receipt_total_mismatch": the items and the taxes of the receipt don't
 *   add up to its total; the lines follow the total, which is what was paid.
 */
export const DRAFT_WARNINGS = ["receipt_total_mismatch"] as const;

export const draftWarningSchema = z.enum(DRAFT_WARNINGS);

export type DraftWarning = z.infer<typeof draftWarningSchema>;

/** Why an existing tag looks like the one proposed. */
export const SIMILAR_TAG_REASONS = [
	/** The same name, but for case, accents and plural. */
	"same_name",
	/** Almost the same: a typo away. */
	"similar_name",
	/** One name holds the other: "Car insurance" and "Insurance". */
	"contains",
] as const;

export const similarTagReasonSchema = z.enum(SIMILAR_TAG_REASONS);

export type SimilarTagReason = z.infer<typeof similarTagReasonSchema>;

/**
 * A tag the assistant proposes when none of the household's fits. It isn't
 * created: the member decides, seeing the existing tags that look like it.
 */
export const proposedTagSchema = z.object({
	/** Named in every language. */
	names: z.object({ en: z.string(), fr: z.string(), es: z.string() }),
	/** An existing tag of the household; null for a tag at the root. */
	parentId: z.uuid().nullable(),
	/** The closest first. */
	similarTags: z.array(
		z.object({ tagId: z.uuid(), reason: similarTagReasonSchema }),
	),
});

export type ProposedTag = z.infer<typeof proposedTagSchema>;

export const draftLineSchema = z.object({
	/** Positive, in minor units. */
	amount: z.number().int().positive(),
	/** An existing tag; null when uncategorized or on the proposed tag. */
	tagId: z.uuid().nullable(),
	/** On the proposed tag, once the member accepts it. */
	usesProposedTag: z.boolean(),
});

export type DraftLine = z.infer<typeof draftLineSchema>;

/**
 * What the assistant understood of a note: a transaction to review, never
 * saved as is. Anything it couldn't tell is null, for the member to fill in.
 */
export const transactionDraftSchema = z.object({
	type: transactionTypeSchema,
	date: calendarDateSchema,
	/** One of the member's accounts that takes transactions. */
	accountId: z.uuid().nullable(),
	/** For a transfer: another account of the household. */
	toAccountId: z.uuid().nullable(),
	payee: z.string().nullable(),
	note: z.string().nullable(),
	/** At least one; a transfer has one, without a tag. */
	lines: z.array(draftLineSchema).min(1),
	proposedTag: proposedTagSchema.nullable(),
	/** A word from the assistant when something is uncertain, in the member's language. */
	remark: z.string().nullable(),
	/** For a draft made from a receipt: what it says, to keep with the transaction. */
	receipt: receiptSchema.nullable(),
	/** What the API noticed, as codes the front ends translate. */
	warnings: z.array(draftWarningSchema),
});

export type TransactionDraft = z.infer<typeof transactionDraftSchema>;
