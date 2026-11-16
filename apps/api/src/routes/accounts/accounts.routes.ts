import {
	adjustAccountSchema,
	createAccountSchema,
	updateAccountSchema,
} from "@repo/schemas";
import { type Context, Hono } from "hono";
import { validate } from "@/lib/validator";
import type { HouseholdVariables } from "@/middlewares/require-household";
import {
	accountParamSchema,
	accountsQuerySchema,
} from "@/routes/accounts/accounts.schemas";
import {
	createAccount,
	deleteAccount,
	getAccount,
	listAccounts,
	summarizeAccounts,
	updateAccount,
	type Viewer,
} from "@/routes/accounts/accounts.service";
import { adjustAccount } from "@/routes/accounts/adjust.service";

type Env = { Variables: HouseholdVariables };

const viewerOf = (c: Context<Env>): Viewer => ({
	userId: c.get("user").id,
	membership: c.get("membership"),
});

/**
 * The accounts of a household. Mounted under
 * `/households/:householdId/accounts`, behind `requireHouseholdMember`.
 */
export const accountRoutes = new Hono<Env>()
	.get("/", validate("query", accountsQuerySchema), async (c) =>
		c.json(await listAccounts(viewerOf(c), c.req.valid("query"))),
	)
	.post("/", validate("json", createAccountSchema), async (c) =>
		c.json(await createAccount(viewerOf(c), c.req.valid("json")), 201),
	)
	// Before "/:accountId", which would otherwise read "summary" as an id
	.get("/summary", async (c) =>
		c.json(await summarizeAccounts(c.get("membership").household.id)),
	)
	.get("/:accountId", validate("param", accountParamSchema), async (c) =>
		c.json(await getAccount(viewerOf(c), c.req.valid("param").accountId)),
	)
	.patch(
		"/:accountId",
		validate("param", accountParamSchema),
		validate("json", updateAccountSchema),
		async (c) =>
			c.json(
				await updateAccount(
					viewerOf(c),
					c.req.valid("param").accountId,
					c.req.valid("json"),
				),
			),
	)
	// What the account really holds on a day: the gap is recorded
	.post(
		"/:accountId/adjust",
		validate("param", accountParamSchema),
		validate("json", adjustAccountSchema),
		async (c) =>
			c.json(
				await adjustAccount(
					viewerOf(c),
					c.req.valid("param").accountId,
					c.req.valid("json"),
				),
			),
	)
	.delete("/:accountId", validate("param", accountParamSchema), async (c) => {
		await deleteAccount(viewerOf(c), c.req.valid("param").accountId);
		return c.body(null, 204);
	});
