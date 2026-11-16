import { updateGettingStartedSchema } from "@repo/schemas";
import { type Context, Hono } from "hono";
import { validate } from "@/lib/validator";
import type { HouseholdVariables } from "@/middlewares/require-household";
import type { Viewer } from "@/routes/accounts/accounts.service";
import {
	gettingStarted,
	updateGettingStarted,
} from "@/routes/getting-started/getting-started.service";

type Env = { Variables: HouseholdVariables };

const viewerOf = (c: Context<Env>): Viewer => ({
	userId: c.get("user").id,
	membership: c.get("membership"),
});

/**
 * A household's first steps, as each member sees them. Mounted under
 * `/households/:householdId/getting-started`, behind `requireHouseholdMember`.
 */
export const gettingStartedRoutes = new Hono<Env>()
	.get("/", async (c) => c.json(await gettingStarted(viewerOf(c))))
	.put("/", validate("json", updateGettingStartedSchema), async (c) =>
		c.json(await updateGettingStarted(viewerOf(c), c.req.valid("json"))),
	);
