import { z } from "zod";

/**
 * What can change in a household. An event names what changed and carries
 * no data: each member then reloads, through the API, what they may see.
 */
export const HOUSEHOLD_EVENT_TOPICS = [
	/** Its name or its currency. */
	"household",
	/** Who belongs to it, and their roles. */
	"members",
	/** Its pending invitations. */
	"invitations",
	"accounts",
	"tags",
	/** Its transactions, and so the balances of its accounts. */
	"transactions",
	/** Its recurring transactions. */
	"recurring",
] as const;

export const householdEventTopicSchema = z.enum(HOUSEHOLD_EVENT_TOPICS);

export type HouseholdEventTopic = z.infer<typeof householdEventTopicSchema>;

/** Sent to the members of a household when something changed in it. */
export const householdEventSchema = z.object({
	topic: householdEventTopicSchema,
});

export type HouseholdEvent = z.infer<typeof householdEventSchema>;
