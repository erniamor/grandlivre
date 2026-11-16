import { BUDGET_PERIODS } from "@repo/schemas";
import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	date,
	foreignKey,
	index,
	pgTable,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "@/db/schema/columns";
import { households } from "@/db/schema/households";
import { tags } from "@/db/schema/tags";
import { users } from "@/db/schema/users";

// The budget of a tag from a month on: the budget of a month is the last
// version that starts on it or before. A version without amount stops the
// budget from its month; the months before keep theirs.
export const budgets = pgTable(
	"budgets",
	{
		id: id(),
		householdId: uuid()
			.notNull()
			.references(() => households.id, { onDelete: "cascade" }),
		tagId: uuid().notNull(),
		period: text({ enum: BUDGET_PERIODS }).notNull(),
		// Minor units, for the whole period; null when stopped from this month
		amount: bigint({ mode: "number" }),
		// The first day of the month it applies from
		fromMonth: date({ mode: "string" }).notNull(),
		updatedBy: uuid().references(() => users.id, { onDelete: "set null" }),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		unique().on(table.tagId, table.fromMonth),
		index().on(table.householdId),
		// The tag belongs to the same household; deleting it (possible only
		// without transactions) deletes its budgets
		foreignKey({
			columns: [table.tagId, table.householdId],
			foreignColumns: [tags.id, tags.householdId],
		}).onDelete("cascade"),
		check(
			"budgets_amount_positive",
			sql`${table.amount} is null or ${table.amount} > 0`,
		),
		check(
			"budgets_from_first_day",
			sql`extract(day from ${table.fromMonth}) = 1`,
		),
	],
);
