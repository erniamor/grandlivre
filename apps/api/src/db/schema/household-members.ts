import { HOUSEHOLD_ROLES } from "@repo/schemas";
import {
	boolean,
	index,
	pgTable,
	primaryKey,
	text,
	uuid,
} from "drizzle-orm/pg-core";
import { createdAt } from "@/db/schema/columns";
import { households } from "@/db/schema/households";
import { users } from "@/db/schema/users";

// One row per user in a household. The model allows a user to belong to
// several households; `createdAt` is the date they joined.
export const householdMembers = pgTable(
	"household_members",
	{
		householdId: uuid()
			.notNull()
			.references(() => households.id, { onDelete: "cascade" }),
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		role: text({ enum: HOUSEHOLD_ROLES }).notNull(),
		// The member put the household's "getting started" away
		gettingStartedHidden: boolean().notNull().default(false),
		createdAt: createdAt(),
	},
	(table) => [
		primaryKey({ columns: [table.householdId, table.userId] }),
		index().on(table.userId),
	],
);
