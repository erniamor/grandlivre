import { inviteHouseholdMemberSchema } from "@repo/schemas";
import { Hono } from "hono";
import { resolveLocale } from "@/lib/locale";
import { validate } from "@/lib/validator";
import { type AuthVariables, requireAuth } from "@/middlewares/require-auth";
import {
	type HouseholdVariables,
	requireHouseholdOwner,
} from "@/middlewares/require-household";
import {
	invitationParamSchema,
	invitationsQuerySchema,
} from "@/routes/invitations/invitations.schemas";
import {
	acceptInvitation,
	cancelInvitation,
	declineInvitation,
	inviteMember,
	listHouseholdInvitations,
	listReceivedInvitations,
} from "@/routes/invitations/invitations.service";

/**
 * The invitations sent by a household. Mounted under
 * `/households/:householdId/invitations`, behind `requireHouseholdMember`.
 */
export const householdInvitationRoutes = new Hono<{
	Variables: HouseholdVariables;
}>()
	.post(
		"/",
		requireHouseholdOwner,
		validate("json", inviteHouseholdMemberSchema),
		async (c) =>
			c.json(
				await inviteMember(
					c.get("membership"),
					c.get("user"),
					c.req.valid("json").email,
					// The email is written in the language of the person inviting
					resolveLocale(c.req.header("accept-language")),
				),
				201,
			),
	)
	.get("/", validate("query", invitationsQuerySchema), async (c) =>
		c.json(
			await listHouseholdInvitations(
				c.get("membership").household.id,
				c.req.valid("query"),
			),
		),
	)
	.delete(
		"/:invitationId",
		requireHouseholdOwner,
		validate("param", invitationParamSchema),
		async (c) => {
			await cancelInvitation(
				c.get("membership").household.id,
				c.req.valid("param").invitationId,
			);
			return c.body(null, 204);
		},
	);

/** The invitations received by the signed-in user. Mounted under `/invitations`. */
export const invitationRoutes = new Hono<{ Variables: AuthVariables }>()
	.use(requireAuth)
	.get("/", validate("query", invitationsQuerySchema), async (c) =>
		c.json(await listReceivedInvitations(c.get("user"), c.req.valid("query"))),
	)
	.post(
		"/:invitationId/accept",
		validate("param", invitationParamSchema),
		async (c) =>
			c.json(
				await acceptInvitation(
					c.get("user"),
					c.req.valid("param").invitationId,
				),
			),
	)
	.post(
		"/:invitationId/decline",
		validate("param", invitationParamSchema),
		async (c) => {
			await declineInvitation(c.get("user"), c.req.valid("param").invitationId);
			return c.body(null, 204);
		},
	);
