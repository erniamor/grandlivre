import { monthSchema, setBudgetSchema } from "@repo/schemas";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { validate } from "@/lib/validator";
import type { HouseholdVariables } from "@/middlewares/require-household";
import type { Viewer } from "@/routes/accounts/accounts.service";
import {
	budgetParamSchema,
	budgetsQuerySchema,
	stopBudgetQuerySchema,
} from "@/routes/budgets/budgets.schemas";
import {
	listBudgets,
	setBudget,
	stopBudget,
	suggestBudget,
} from "@/routes/budgets/budgets.service";

type Env = { Variables: HouseholdVariables };

const viewerOf = (c: Context<Env>): Viewer => ({
	userId: c.get("user").id,
	membership: c.get("membership"),
});

/**
 * The budgets of a household, shared and managed by its members. Mounted
 * under `/households/:householdId/budgets`, behind `requireHouseholdMember`.
 */
export const budgetRoutes = new Hono<Env>()
	.get("/", validate("query", budgetsQuerySchema), async (c) =>
		c.json(await listBudgets(viewerOf(c), c.req.valid("query").month)),
	)
	.put(
		"/:tagId",
		validate("param", budgetParamSchema),
		validate("json", setBudgetSchema),
		async (c) =>
			c.json(
				await setBudget(
					viewerOf(c),
					c.req.valid("param").tagId,
					c.req.valid("json"),
				),
			),
	)
	.delete(
		"/:tagId",
		validate("param", budgetParamSchema),
		validate("query", stopBudgetQuerySchema),
		async (c) => {
			await stopBudget(
				viewerOf(c),
				c.req.valid("param").tagId,
				c.req.valid("query").from,
			);
			return c.body(null, 204);
		},
	)
	.get(
		"/:tagId/suggestion",
		validate("param", budgetParamSchema),
		validate("query", z.object({ month: monthSchema.optional() })),
		async (c) =>
			c.json(
				await suggestBudget(
					viewerOf(c),
					c.req.valid("param").tagId,
					c.req.valid("query").month,
				),
			),
	);
