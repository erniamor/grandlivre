import {
	createHouseholdSchema,
	updateHouseholdMemberSchema,
	updateHouseholdSchema,
} from "@repo/schemas";
import { Hono } from "hono";
import { validate } from "@/lib/validator";
import { requireAuth } from "@/middlewares/require-auth";
import {
	type HouseholdVariables,
	requireHouseholdMember,
	requireHouseholdOwner,
} from "@/middlewares/require-household";
import {
	householdsQuerySchema,
	memberParamSchema,
	membersQuerySchema,
} from "@/routes/households/households.schemas";
import {
	createHousehold,
	listHouseholds,
	listMembers,
	removeMember,
	toHousehold,
	updateHousehold,
	updateMemberRole,
} from "@/routes/households/households.service";

export const householdRoutes = new Hono<{ Variables: HouseholdVariables }>()
	.use(requireAuth)
	.post("/", validate("json", createHouseholdSchema), async (c) =>
		c.json(await createHousehold(c.get("user").id, c.req.valid("json")), 201),
	)
	.get("/", validate("query", householdsQuerySchema), async (c) =>
		c.json(await listHouseholds(c.get("user").id, c.req.valid("query"))),
	)
	// Everything below belongs to one household, open to its members only
	// ("/:householdId/*" also matches "/:householdId" itself)
	.use("/:householdId/*", requireHouseholdMember)
	.get("/:householdId", (c) => c.json(toHousehold(c.get("membership"))))
	.patch(
		"/:householdId",
		requireHouseholdOwner,
		validate("json", updateHouseholdSchema),
		async (c) =>
			c.json(await updateHousehold(c.get("membership"), c.req.valid("json"))),
	)
	.get(
		"/:householdId/members",
		validate("query", membersQuerySchema),
		async (c) =>
			c.json(
				await listMembers(
					c.get("membership").household.id,
					c.req.valid("query"),
				),
			),
	)
	.patch(
		"/:householdId/members/:userId",
		requireHouseholdOwner,
		validate("param", memberParamSchema),
		validate("json", updateHouseholdMemberSchema),
		async (c) => {
			await updateMemberRole(
				c.get("membership").household.id,
				c.req.valid("param").userId,
				c.req.valid("json").role,
			);
			return c.body(null, 204);
		},
	)
	// A member removes themselves (leaves); an owner removes anyone
	.delete(
		"/:householdId/members/:userId",
		validate("param", memberParamSchema),
		async (c) => {
			const { household, role } = c.get("membership");
			await removeMember(
				household.id,
				{ userId: c.get("user").id, role },
				c.req.valid("param").userId,
			);
			return c.body(null, 204);
		},
	);
