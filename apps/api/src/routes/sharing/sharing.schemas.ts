import { z } from "zod";
import { paginationQuerySchema } from "@/lib/pagination";

export const sharingPageSchema = paginationQuerySchema({
	defaultPageSize: 50,
	maxPageSize: 100,
});

export type SharingPage = z.infer<typeof sharingPageSchema>;

export const settlementParamSchema = z.object({ settlementId: z.uuid() });
