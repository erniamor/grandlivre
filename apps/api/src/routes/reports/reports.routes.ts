import { type Context, Hono } from "hono";
import { validate } from "@/lib/validator";
import type { HouseholdVariables } from "@/middlewares/require-household";
import type { Viewer } from "@/routes/accounts/accounts.service";
import {
	monthlyReportQuerySchema,
	tagReportQuerySchema,
} from "@/routes/reports/reports.schemas";
import { monthlyReport, tagReport } from "@/routes/reports/reports.service";

type Env = { Variables: HouseholdVariables };

const viewerOf = (c: Context<Env>): Viewer => ({
	userId: c.get("user").id,
	membership: c.get("membership"),
});

/**
 * What the household earns and spends. Mounted under
 * `/households/:householdId/reports`, behind `requireHouseholdMember`.
 */
export const reportRoutes = new Hono<Env>()
	.get("/tags", validate("query", tagReportQuerySchema), async (c) =>
		c.json(await tagReport(viewerOf(c), c.req.valid("query"))),
	)
	.get("/monthly", validate("query", monthlyReportQuerySchema), async (c) =>
		c.json(await monthlyReport(viewerOf(c), c.req.valid("query"))),
	);
