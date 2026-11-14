import { z } from "zod";
import { paginationQuerySchema } from "@/lib/pagination";

export const householdsQuerySchema = paginationQuerySchema({
	defaultPageSize: 20,
	maxPageSize: 50,
});

export const membersQuerySchema = paginationQuerySchema({
	defaultPageSize: 50,
	maxPageSize: 100,
});

export const memberParamSchema = z.object({ userId: z.uuid() });
