import { z } from "zod";
import { paginationQuerySchema } from "@/lib/pagination";

export const accountsQuerySchema = paginationQuerySchema({
	defaultPageSize: 50,
	maxPageSize: 100,
});

export const accountParamSchema = z.object({ accountId: z.uuid() });
