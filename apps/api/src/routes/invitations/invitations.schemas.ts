import { z } from "zod";
import { paginationQuerySchema } from "@/lib/pagination";

export const invitationsQuerySchema = paginationQuerySchema({
	defaultPageSize: 20,
	maxPageSize: 50,
});

export const invitationParamSchema = z.object({ invitationId: z.uuid() });
