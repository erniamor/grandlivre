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
import { accountRoutes } from "@/routes/accounts/accounts.routes";
import { budgetRoutes } from "@/routes/budgets/budgets.routes";
import { eventRoutes } from "@/routes/events/events.routes";
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
import { householdInvitationRoutes } from "@/routes/invitations/invitations.routes";
import { recurringRoutes } from "@/routes/recurring/recurring.routes";
import { reportRoutes } from "@/routes/reports/reports.routes";
import { sharingRoutes } from "@/routes/sharing/sharing.routes";
import { tagRoutes } from "@/routes/tags/tags.routes";
import { transactionRoutes } from "@/routes/transactions/transactions.routes";

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
	.route("/:householdId/accounts", accountRoutes)
	.route("/:householdId/budgets", budgetRoutes)
	.route("/:householdId/events", eventRoutes)
	.route("/:householdId/invitations", householdInvitationRoutes)
	.route("/:householdId/recurring-transactions", recurringRoutes)
	.route("/:householdId/reports", reportRoutes)
	.route("/:householdId/sharing", sharingRoutes)
	.route("/:householdId/tags", tagRoutes)
	.route("/:householdId/transactions", transactionRoutes)
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
