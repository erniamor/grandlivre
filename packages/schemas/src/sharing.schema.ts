import { z } from "zod";
import { amountSchema, calendarDateSchema, dateTimeSchema } from "./common";

// Settling shared expenses: optional, off by default for a household. Some
// households pool everything and never settle between members.

/** Members a transaction can be shared among. */
export const SHARE_MAX_MEMBERS = 20;

/** The largest weight of a member in a split: 60 and 40, 2 and 1... */
export const SHARE_MAX_WEIGHT = 1000;

const memberIdSchema = z.uuid("share_member_invalid");

const weightSchema = z
	.number("share_weight_invalid")
	.int("share_weight_invalid")
	.min(0, "share_weight_invalid")
	.max(SHARE_MAX_WEIGHT, "share_weight_invalid");

/**
 * How an expense (or a refund) paid from one member's own account is split
 * among members, the payer included or not:
 * - "equal": in equal parts among `userIds`;
 * - "weights": in proportion to each one's `weight` (60 and 40: 60/40);
 * - "amounts": each one's `amount`, in minor units, adding up to the
 *   transaction's amount.
 * Parts are rounded to the minor unit and always add up to the amount.
 */
export const shareSplitSchema = z.discriminatedUnion(
	"mode",
	[
		z.strictObject({
			mode: z.literal("equal"),
			userIds: z
				.array(memberIdSchema)
				.min(1, "share_members_required")
				.max(SHARE_MAX_MEMBERS, "share_members_invalid"),
		}),
		z.strictObject({
			mode: z.literal("weights"),
			parts: z
				.array(z.strictObject({ userId: memberIdSchema, weight: weightSchema }))
				.min(1, "share_members_required")
				.max(SHARE_MAX_MEMBERS, "share_members_invalid"),
		}),
		z.strictObject({
			mode: z.literal("amounts"),
			parts: z
				.array(z.strictObject({ userId: memberIdSchema, amount: amountSchema }))
				.min(1, "share_members_required")
				.max(SHARE_MAX_MEMBERS, "share_members_invalid"),
		}),
	],
	"share_mode_invalid",
);

export type ShareSplit = z.infer<typeof shareSplitSchema>;

/** One member's part of a shared transaction, in minor units. */
export const sharePartSchema = z.object({
	userId: z.uuid(),
	amount: z.number().int(),
});

export type SharePart = z.infer<typeof sharePartSchema>;

/** How a transaction is shared, as seen with it. */
export const transactionSharingSchema = z.object({
	/** The holder of the account it was paid from (or received on). */
	paidBy: z.uuid(),
	/** The split as it was given, to change it. */
	split: shareSplitSchema,
	/** Each member's part. */
	parts: z.array(sharePartSchema),
});

export type TransactionSharing = z.infer<typeof transactionSharingSchema>;

/** A member's default weight, when a split follows the household's. */
export const sharingWeightSchema = z.object({
	userId: z.uuid(),
	weight: weightSchema,
});

export type SharingWeight = z.infer<typeof sharingWeightSchema>;

/** The household's default split: one weight per member. */
export const updateSharingWeightsSchema = z.strictObject({
	weights: z
		.array(z.strictObject({ userId: memberIdSchema, weight: weightSchema }))
		.min(1, "share_members_required")
		.max(SHARE_MAX_MEMBERS, "share_members_invalid"),
});

export type UpdateSharingWeights = z.infer<typeof updateSharingWeightsSchema>;

/**
 * Where a member stands: positive when the others owe them, negative when
 * they owe the others. In minor units.
 */
export const sharingBalanceSchema = z.object({
	userId: z.uuid(),
	/** Their name, or their email until they choose one. */
	name: z.string(),
	/** False for someone who left the household with a balance. */
	isMember: z.boolean(),
	balance: z.number().int(),
});

export type SharingBalance = z.infer<typeof sharingBalanceSchema>;

/** A payment that settles balances: as few of them as possible. */
export const settlementSuggestionSchema = z.object({
	fromUserId: z.uuid(),
	toUserId: z.uuid(),
	amount: z.number().int(),
});

export type SettlementSuggestion = z.infer<typeof settlementSuggestionSchema>;

/** Where the household's members stand, and how to settle. */
export const sharingOverviewSchema = z.object({
	/** The default split: the members' weights, 1 when never set. */
	weights: z.array(sharingWeightSchema),
	/** Every member, and anyone else with a balance, the most owed first. */
	balances: z.array(sharingBalanceSchema),
	/** The fewest payments that bring every balance to zero. */
	suggestions: z.array(settlementSuggestionSchema),
});

export type SharingOverview = z.infer<typeof sharingOverviewSchema>;

/** A shared transaction, as the members it involves see it. */
export const sharedExpenseSchema = z.object({
	transactionId: z.uuid(),
	type: z.enum(["expense", "income"]),
	date: calendarDateSchema,
	payee: z.string().nullable(),
	amount: z.number().int(),
	paidBy: z.uuid(),
	parts: z.array(sharePartSchema),
});

export type SharedExpense = z.infer<typeof sharedExpenseSchema>;

export const SETTLEMENT_NOTE_MAX_LENGTH = 200;

/**
 * A payment from one member to another that settles what they owe. With
 * `transfer`, it is also recorded as a transfer between their accounts:
 * from an account the payer holds (and the user recording it) to one the
 * other holds.
 */
export const createSettlementSchema = z
	.strictObject({
		fromUserId: memberIdSchema,
		toUserId: memberIdSchema,
		amount: amountSchema.min(1, "amount_not_positive"),
		date: calendarDateSchema,
		// trim(): a note made only of spaces counts as none
		note: z
			.string()
			.trim()
			.max(SETTLEMENT_NOTE_MAX_LENGTH, "settlement_note_too_long")
			.nullable()
			.optional(),
		transfer: z
			.strictObject({
				fromAccountId: z.uuid("transaction_account_invalid"),
				toAccountId: z.uuid("transaction_account_invalid"),
			})
			.optional(),
	})
	.refine((input) => input.fromUserId !== input.toUserId, {
		message: "settlement_same_member",
		path: ["toUserId"],
	});

export type CreateSettlement = z.infer<typeof createSettlementSchema>;

/** A settlement, as every member sees it. */
export const settlementSchema = z.object({
	id: z.uuid(),
	fromUserId: z.uuid(),
	toUserId: z.uuid(),
	amount: z.number().int(),
	date: calendarDateSchema,
	note: z.string().nullable(),
	/** The transfer recorded with it, if any. */
	transactionId: z.uuid().nullable(),
	createdAt: dateTimeSchema,
});

export type Settlement = z.infer<typeof settlementSchema>;
