import { z } from "zod";
import { dateTimeSchema, emailSchema } from "./common";

export const HOUSEHOLD_NAME_MAX_LENGTH = 60;

/** Currencies a household can use (ISO 4217 codes). */
export const HOUSEHOLD_CURRENCIES = [
	"CAD",
	"USD",
	"EUR",
	"GBP",
	"CHF",
	"AUD",
	"NZD",
	"JPY",
	"MXN",
	"BRL",
	"ARS",
	"CLP",
	"COP",
] as const;

/** An owner manages the household (name, currency, members, invitations). */
export const HOUSEHOLD_ROLES = ["owner", "member"] as const;

/** Days during which an invitation can be accepted. */
export const HOUSEHOLD_INVITATION_EXPIRES_IN_DAYS = 7;

// Error messages are codes, translated by the front ends.
// trim(): a name made only of spaces counts as empty.
export const householdNameSchema = z
	.string()
	.trim()
	.min(1, "household_name_required")
	.max(HOUSEHOLD_NAME_MAX_LENGTH, "household_name_too_long");

export const householdCurrencySchema = z.enum(
	HOUSEHOLD_CURRENCIES,
	"household_currency_invalid",
);

export type HouseholdCurrency = z.infer<typeof householdCurrencySchema>;

export const householdRoleSchema = z.enum(HOUSEHOLD_ROLES);

export type HouseholdRole = z.infer<typeof householdRoleSchema>;

export const createHouseholdSchema = z.strictObject({
	name: householdNameSchema,
	currency: householdCurrencySchema,
});

export type CreateHousehold = z.infer<typeof createHouseholdSchema>;

/** Every field is optional: only the ones sent are changed. */
export const updateHouseholdSchema = createHouseholdSchema.partial();

export type UpdateHousehold = z.infer<typeof updateHouseholdSchema>;

/** A household, as seen by one of its members. */
export const householdSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	currency: householdCurrencySchema,
	/** Role of the signed-in user in this household. */
	role: householdRoleSchema,
	createdAt: dateTimeSchema,
});

export type Household = z.infer<typeof householdSchema>;

export const householdMemberSchema = z.object({
	userId: z.uuid(),
	name: z.string(),
	email: z.email(),
	image: z.string().nullable(),
	role: householdRoleSchema,
	joinedAt: dateTimeSchema,
});

export type HouseholdMember = z.infer<typeof householdMemberSchema>;

export const inviteHouseholdMemberSchema = z.strictObject({
	email: emailSchema,
});

export type InviteHouseholdMember = z.infer<typeof inviteHouseholdMemberSchema>;

/** A pending invitation, as seen by the members of the household. */
export const householdInvitationSchema = z.object({
	id: z.uuid(),
	email: z.email(),
	invitedByName: z.string(),
	expiresAt: dateTimeSchema,
	createdAt: dateTimeSchema,
});

export type HouseholdInvitation = z.infer<typeof householdInvitationSchema>;

/** A pending invitation, as seen by the person invited. */
export const receivedInvitationSchema = z.object({
	id: z.uuid(),
	household: z.object({ id: z.uuid(), name: z.string() }),
	invitedByName: z.string(),
	expiresAt: dateTimeSchema,
});

export type ReceivedInvitation = z.infer<typeof receivedInvitationSchema>;
