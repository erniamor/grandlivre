import { z } from "zod";
import { calendarDateSchema, dateTimeSchema } from "./common";
import { shareSplitSchema } from "./sharing.schema";
import {
	transactionLineSchema,
	transactionTemplateSchema,
	transactionTypeSchema,
} from "./transaction.schema";

/** What a recurring transaction repeats on: every N weeks, months or years. */
export const RECURRENCE_UNITS = ["week", "month", "year"] as const;

/**
 * - "automatic": recorded on its own when its day comes (a rent, a
 *   subscription: the same amount each time);
 * - "confirm": waits for a member to confirm it, its amount open to change
 *   (a power bill); the default.
 */
export const RECURRENCE_MODES = ["automatic", "confirm"] as const;

/**
 * What became of a day a recurring transaction came due:
 * - "pending": waits for a member to confirm or skip it;
 * - "recorded": its transaction was recorded;
 * - "skipped": a member chose not to record it.
 */
export const OCCURRENCE_STATUSES = ["pending", "recorded", "skipped"] as const;

/** How far ahead the upcoming days of the recurring transactions go. */
export const UPCOMING_MAX_DAYS = 90;

/** Every 1 to 99 weeks, months or years. */
export const RECURRENCE_MAX_INTERVAL = 99;

export const recurrenceUnitSchema = z.enum(
	RECURRENCE_UNITS,
	"recurrence_unit_invalid",
);

export type RecurrenceUnit = z.infer<typeof recurrenceUnitSchema>;

export const recurrenceModeSchema = z.enum(
	RECURRENCE_MODES,
	"recurrence_mode_invalid",
);

export type RecurrenceMode = z.infer<typeof recurrenceModeSchema>;

/**
 * When a transaction repeats: from `startDate`, its first day, every
 * `interval` `unit`s, until `endDate` included if any. A monthly date past
 * the end of a shorter month falls on its last day (the 31st on the 30th,
 * on February 28th), and comes back on the 31st the month after.
 */
export const recurrenceScheduleSchema = z.strictObject({
	unit: recurrenceUnitSchema,
	interval: z
		.number("recurrence_interval_invalid")
		.int("recurrence_interval_invalid")
		.min(1, "recurrence_interval_invalid")
		.max(RECURRENCE_MAX_INTERVAL, "recurrence_interval_invalid"),
	startDate: calendarDateSchema,
	endDate: calendarDateSchema.nullable(),
});

export type RecurrenceSchedule = z.infer<typeof recurrenceScheduleSchema>;

/**
 * A recurring transaction, created or changed as a whole. Its first day
 * can't be in the past (in the household's time zone): what already
 * happened is entered by hand.
 */
export const updateRecurringTransactionSchema = z
	.strictObject({
		transaction: transactionTemplateSchema,
		schedule: recurrenceScheduleSchema,
		/** "confirm" when missing. */
		mode: recurrenceModeSchema.optional(),
	})
	.refine(
		({ schedule }) =>
			schedule.endDate === null || schedule.endDate >= schedule.startDate,
		{ message: "recurrence_end_before_start", path: ["schedule", "endDate"] },
	);

export type UpdateRecurringTransaction = z.infer<
	typeof updateRecurringTransactionSchema
>;

export const createRecurringTransactionSchema =
	updateRecurringTransactionSchema;

export type CreateRecurringTransaction = UpdateRecurringTransaction;

/** A recurring transaction, as seen by a member who may see its account's details. */
export const recurringTransactionSchema = z.object({
	id: z.uuid(),
	householdId: z.uuid(),
	transaction: z.object({
		type: transactionTypeSchema,
		accountId: z.uuid(),
		toAccountId: z.uuid().nullable(),
		/** Positive, in minor units: for an expense or an income, the sum of its lines. */
		amount: z.number().int(),
		payee: z.string().nullable(),
		note: z.string().nullable(),
		/** Empty for a transfer. */
		lines: z.array(transactionLineSchema.omit({ id: true })),
		/**
		 * How each transaction it records is shared among members, when the
		 * household settles shared expenses; missing when it isn't.
		 */
		shares: shareSplitSchema.optional(),
	}),
	schedule: z.object({
		unit: recurrenceUnitSchema,
		interval: z.number().int(),
		startDate: calendarDateSchema,
		endDate: calendarDateSchema.nullable(),
	}),
	mode: recurrenceModeSchema,
	/** Its next day not yet recorded or waiting; null once it has ended. */
	nextDate: calendarDateSchema.nullable(),
	/** Who created it; null once they left the product. */
	createdBy: z.object({ userId: z.uuid(), name: z.string() }).nullable(),
	createdAt: dateTimeSchema,
	updatedAt: dateTimeSchema,
});

export type RecurringTransaction = z.infer<typeof recurringTransactionSchema>;

/** A day a recurring transaction came due, waiting for a member to confirm or skip it. */
export const pendingOccurrenceSchema = z.object({
	id: z.uuid(),
	date: calendarDateSchema,
	/** What it records, as it is now: the confirmation can change it. */
	recurring: recurringTransactionSchema,
});

export type PendingOccurrence = z.infer<typeof pendingOccurrenceSchema>;

/** A day a recurring transaction will come due. */
export const upcomingOccurrenceSchema = z.object({
	date: calendarDateSchema,
	recurring: recurringTransactionSchema,
});

export type UpcomingOccurrence = z.infer<typeof upcomingOccurrenceSchema>;

/** How many of a suggested series' last days come with it. */
export const SUGGESTION_MAX_DATES = 12;

/** The longest payee key a dismissal holds. */
export const SUGGESTION_KEY_MAX_LENGTH = 200;

/**
 * What tells a suggested series apart, as a dismissal names it: its
 * accounts, type, payee (its letters only, lowercased), cadence, and a day
 * it is expected on.
 */
export const recurringSuggestionKeySchema = z
	.strictObject({
		accountId: z.uuid(),
		/** Where a transfer goes; null otherwise. */
		toAccountId: z.uuid().nullable(),
		type: transactionTypeSchema,
		key: z.string().max(SUGGESTION_KEY_MAX_LENGTH),
		unit: recurrenceUnitSchema,
		interval: z.number().int().min(1).max(RECURRENCE_MAX_INTERVAL),
		/** The day it was next expected on. */
		startDate: calendarDateSchema,
	})
	.refine(
		({ type, toAccountId }) => (type === "transfer") === (toAccountId !== null),
		{ message: "transfer_destination_invalid", path: ["toAccountId"] },
	);

export type RecurringSuggestionKey = z.infer<
	typeof recurringSuggestionKeySchema
>;

/**
 * A series found in the history of an account the member holds, offered
 * as a recurring transaction: they confirm it in the recurring form, or
 * dismiss it.
 */
export const recurringSuggestionSchema = z.object({
	accountId: z.uuid(),
	toAccountId: z.uuid().nullable(),
	type: transactionTypeSchema,
	/** Its payee's letters, lowercased: with the rest, what a dismissal names. */
	key: z.string(),
	/** As last written by the bank or a member. */
	payee: z.string().nullable(),
	unit: recurrenceUnitSchema,
	interval: z.number().int(),
	/** Positive, in minor units: its last amount when steady, else its median. */
	amount: z.number().int(),
	minAmount: z.number().int(),
	maxAmount: z.number().int(),
	/** "automatic" when its last amounts are the same. */
	mode: recurrenceModeSchema,
	/** The next day it is expected on: the recurring transaction's first day. */
	nextDate: calendarDateSchema,
	/** The tag it is most often given. */
	tagId: z.uuid().nullable(),
	/** How many times it was seen. */
	count: z.number().int(),
	/** Its last days, at most `SUGGESTION_MAX_DATES`, oldest first. */
	dates: z.array(calendarDateSchema),
});

export type RecurringSuggestion = z.infer<typeof recurringSuggestionSchema>;
