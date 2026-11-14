import { createMiddleware } from "hono/factory";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { AuthVariables } from "@/middlewares/require-auth";
import {
	findMembership,
	type Membership,
} from "@/routes/households/households.service";

export interface HouseholdVariables extends AuthVariables {
	/** The household of the route and the signed-in user's role in it. */
	membership: Membership;
}

const householdIdSchema = z.uuid();

/**
 * Loads the household named by the `:householdId` parameter, for its members
 * only. Anyone else gets a 404, as for a household that doesn't exist: the
 * API never reveals that a household exists to someone outside it.
 * Must run after `requireAuth`.
 */
export const requireHouseholdMember = createMiddleware<{
	Variables: HouseholdVariables;
}>(async (c, next) => {
	const householdId = householdIdSchema.safeParse(c.req.param("householdId"));
	const membership = householdId.success
		? await findMembership(householdId.data, c.get("user").id)
		: undefined;
	if (!membership) {
		throw new AppError(404, "not_found", "Household not found");
	}
	c.set("membership", membership);
	await next();
});

/** Rejects members who aren't owners. Must run after `requireHouseholdMember`. */
export const requireHouseholdOwner = createMiddleware<{
	Variables: HouseholdVariables;
}>(async (c, next) => {
	if (c.get("membership").role !== "owner") {
		throw new AppError(
			403,
			"forbidden",
			"Only an owner of the household can do this",
		);
	}
	await next();
});
