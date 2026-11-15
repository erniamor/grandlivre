import {
	createRecurringTransactionSchema,
	updateRecurringTransactionSchema,
} from "@repo/schemas";
import { type Context, Hono } from "hono";
import { validate } from "@/lib/validator";
import type { HouseholdVariables } from "@/middlewares/require-household";
import type { Viewer } from "@/routes/accounts/accounts.service";
import {
	recurringParamSchema,
	recurringQuerySchema,
} from "@/routes/recurring/recurring.schemas";
import {
	createRecurring,
	deleteRecurring,
	getRecurring,
	listRecurring,
	updateRecurring,
} from "@/routes/recurring/recurring.service";

type Env = { Variables: HouseholdVariables };

const viewerOf = (c: Context<Env>): Viewer => ({
	userId: c.get("user").id,
	membership: c.get("membership"),
});

/**
 * The recurring transactions of a household. Mounted under
 * `/households/:householdId/recurring-transactions`, behind
 * `requireHouseholdMember`.
 */
export const recurringRoutes = new Hono<Env>()
	.get("/", validate("query", recurringQuerySchema), async (c) =>
		c.json(await listRecurring(viewerOf(c), c.req.valid("query"))),
	)
	.post("/", validate("json", createRecurringTransactionSchema), async (c) =>
		c.json(await createRecurring(viewerOf(c), c.req.valid("json")), 201),
	)
	.get("/:recurringId", validate("param", recurringParamSchema), async (c) =>
		c.json(await getRecurring(viewerOf(c), c.req.valid("param").recurringId)),
	)
	.put(
		"/:recurringId",
		validate("param", recurringParamSchema),
		validate("json", updateRecurringTransactionSchema),
		async (c) =>
			c.json(
				await updateRecurring(
					viewerOf(c),
					c.req.valid("param").recurringId,
					c.req.valid("json"),
				),
			),
	)
	.delete(
		"/:recurringId",
		validate("param", recurringParamSchema),
		async (c) => {
			await deleteRecurring(viewerOf(c), c.req.valid("param").recurringId);
			return c.body(null, 204);
		},
	);
