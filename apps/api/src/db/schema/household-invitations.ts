import {
	index,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id } from "@/db/schema/columns";
import { households } from "@/db/schema/households";
import { users } from "@/db/schema/users";

// A pending invitation to join a household, addressed to an email: signing in
// with that email is what proves the invitation is theirs, so there is no token.
// The row is deleted once the invitation is accepted, declined or cancelled.
export const householdInvitations = pgTable(
	"household_invitations",
	{
		id: id(),
		householdId: uuid()
			.notNull()
			.references(() => households.id, { onDelete: "cascade" }),
		// Lowercase, as normalized by emailSchema
		email: text().notNull(),
		invitedBy: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		expiresAt: timestamp({ withTimezone: true }).notNull(),
		createdAt: createdAt(),
	},
	(table) => [
		unique().on(table.householdId, table.email),
		index().on(table.email),
	],
);
