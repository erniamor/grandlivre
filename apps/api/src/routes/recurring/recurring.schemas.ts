import { UPCOMING_MAX_DAYS } from "@repo/schemas";
import { z } from "zod";
import { paginationQuerySchema } from "@/lib/pagination";

export const recurringQuerySchema = paginationQuerySchema({
	defaultPageSize: 50,
	maxPageSize: 100,
});

export type RecurringQuery = z.infer<typeof recurringQuerySchema>;

export const recurringParamSchema = z.object({ recurringId: z.uuid() });

export const upcomingQuerySchema = paginationQuerySchema({
	defaultPageSize: 50,
	maxPageSize: 100,
}).extend({
	/** From today, included, to this many days after. */
	days: z.coerce.number().int().min(1).max(UPCOMING_MAX_DAYS).default(30),
});

export type UpcomingQuery = z.infer<typeof upcomingQuerySchema>;

export const occurrenceParamSchema = z.object({ occurrenceId: z.uuid() });
