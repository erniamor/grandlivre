import {
	createSettlementSchema,
	updateSharingWeightsSchema,
} from "@repo/schemas";
import { type Context, Hono } from "hono";
import { validate } from "@/lib/validator";
import type { HouseholdVariables } from "@/middlewares/require-household";
import type { Viewer } from "@/routes/accounts/accounts.service";
import {
	settlementParamSchema,
	sharingPageSchema,
} from "@/routes/sharing/sharing.schemas";
import {
	createSettlement,
	deleteSettlement,
	listSettlements,
	listSharedExpenses,
	setSharingWeights,
	sharingOverview,
} from "@/routes/sharing/sharing.service";

type Env = { Variables: HouseholdVariables };

const viewerOf = (c: Context<Env>): Viewer => ({
	userId: c.get("user").id,
	membership: c.get("membership"),
});

/**
 * Settling shared expenses between members, for the households that turn
 * it on (409 `sharing_disabled` otherwise). Mounted under
 * `/households/:householdId/sharing`, behind `requireHouseholdMember`.
 */
export const sharingRoutes = new Hono<Env>()
	.get("/", async (c) => c.json(await sharingOverview(viewerOf(c))))
	.put("/weights", validate("json", updateSharingWeightsSchema), async (c) =>
		c.json(await setSharingWeights(viewerOf(c), c.req.valid("json"))),
	)
	.get("/expenses", validate("query", sharingPageSchema), async (c) =>
		c.json(await listSharedExpenses(viewerOf(c), c.req.valid("query"))),
	)
	.get("/settlements", validate("query", sharingPageSchema), async (c) =>
		c.json(await listSettlements(viewerOf(c), c.req.valid("query"))),
	)
	.post("/settlements", validate("json", createSettlementSchema), async (c) =>
		c.json(await createSettlement(viewerOf(c), c.req.valid("json")), 201),
	)
	.delete(
		"/settlements/:settlementId",
		validate("param", settlementParamSchema),
		async (c) => {
			await deleteSettlement(viewerOf(c), c.req.valid("param").settlementId);
			return c.body(null, 204);
		},
	);
