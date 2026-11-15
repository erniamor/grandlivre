import { createTagSchema, updateTagSchema } from "@repo/schemas";
import { Hono } from "hono";
import { validate } from "@/lib/validator";
import type { HouseholdVariables } from "@/middlewares/require-household";
import { tagParamSchema, tagsQuerySchema } from "@/routes/tags/tags.schemas";
import {
	addSuggestedTags,
	createTag,
	deleteTag,
	listTags,
	updateTag,
} from "@/routes/tags/tags.service";

/**
 * The tags of a household, shared and managed by all its members. Mounted
 * under `/households/:householdId/tags`, behind `requireHouseholdMember`.
 */
export const tagRoutes = new Hono<{ Variables: HouseholdVariables }>()
	.get("/", validate("query", tagsQuerySchema), async (c) =>
		c.json(
			await listTags(c.get("membership").household.id, c.req.valid("query")),
		),
	)
	.post("/", validate("json", createTagSchema), async (c) =>
		c.json(
			await createTag(c.get("membership").household.id, c.req.valid("json")),
			201,
		),
	)
	// Before "/:tagId", which would otherwise read "suggested" as an id
	.post("/suggested", async (c) => {
		await addSuggestedTags(c.get("membership").household.id);
		return c.body(null, 204);
	})
	.patch(
		"/:tagId",
		validate("param", tagParamSchema),
		validate("json", updateTagSchema),
		async (c) =>
			c.json(
				await updateTag(
					c.get("membership").household.id,
					c.req.valid("param").tagId,
					c.req.valid("json"),
				),
			),
	)
	.delete("/:tagId", validate("param", tagParamSchema), async (c) => {
		await deleteTag(
			c.get("membership").household.id,
			c.req.valid("param").tagId,
		);
		return c.body(null, 204);
	});
