import { z } from "zod";
import { paginationQuerySchema } from "@/lib/pagination";

export const recurringQuerySchema = paginationQuerySchema({
	defaultPageSize: 50,
	maxPageSize: 100,
});

export type RecurringQuery = z.infer<typeof recurringQuerySchema>;

export const recurringParamSchema = z.object({ recurringId: z.uuid() });
