import { z } from "zod";
import { calendarDateSchema, dateTimeSchema } from "./common";
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
