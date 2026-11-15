import { MAX_TAGS_PER_HOUSEHOLD } from "@repo/schemas";
import { z } from "zod";
import { paginationQuerySchema } from "@/lib/pagination";

// A household's whole tree of tags fits in one page
export const tagsQuerySchema = paginationQuerySchema({
	defaultPageSize: MAX_TAGS_PER_HOUSEHOLD,
	maxPageSize: MAX_TAGS_PER_HOUSEHOLD,
});

export const tagParamSchema = z.object({ tagId: z.uuid() });
