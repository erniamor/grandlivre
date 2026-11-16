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
});

export type TransactionsQuery = z.infer<typeof transactionsQuerySchema>;

export const transactionParamSchema = z.object({ transactionId: z.uuid() });

/** The payees without a tag: a family's fit in a few pages. */
export const uncategorizedQuerySchema = paginationQuerySchema({
	defaultPageSize: 50,
	maxPageSize: 200,
});
