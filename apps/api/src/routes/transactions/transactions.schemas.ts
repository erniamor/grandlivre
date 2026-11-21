import { calendarDateSchema, transactionTypeSchema } from "@repo/schemas";
import { z } from "zod";
import { paginationQuerySchema } from "@/lib/pagination";

export const transactionsQuerySchema = paginationQuerySchema({
	defaultPageSize: 50,
	maxPageSize: 100,
}).extend({
	/** The transactions of this account, transfers it receives included. */
	accountId: z.uuid().optional(),
	/** The transactions with a line on this tag or on one of the tags under it. */
	tagId: z.uuid().optional(),
	type: transactionTypeSchema.optional(),
	/** From this day on, included. */
	from: calendarDateSchema.optional(),
	/** Up to this day, included. */
	to: calendarDateSchema.optional(),
	/**
	 * Words each found in the payee, the note, or a receipt's merchant or
	 * items, accents and case aside.
	 */
	q: z.string().trim().max(100).optional(),
	/** The total of the transaction, in minor units: at least this much. */
	minAmount: z.coerce.number().int().min(0).optional(),
	/** At most this much. */
	maxAmount: z.coerce.number().int().min(0).optional(),
	/**
	 * The expenses and incomes with a line without a tag: still to
	 * categorize, or set aside as undetermined.
	 */
	untagged: z.enum(["to-define", "undetermined"]).optional(),
});

export type TransactionsQuery = z.infer<typeof transactionsQuerySchema>;

export const transactionParamSchema = z.object({ transactionId: z.uuid() });

/** Counts the expenses and incomes without a tag before a day, excluded. */
export const uncategorizedCountQuerySchema = z.object({
	before: calendarDateSchema,
});

/** The payees without a tag: a family's fit in a few pages. */
export const uncategorizedQuerySchema = paginationQuerySchema({
	defaultPageSize: 50,
	maxPageSize: 200,
});
