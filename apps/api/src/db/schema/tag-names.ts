import { LOCALES } from "@repo/schemas";
import { sql } from "drizzle-orm";
import {
	foreignKey,
	index,
	pgTable,
	primaryKey,
	text,
	uuid,
} from "drizzle-orm/pg-core";
import { tags } from "@/db/schema/tags";

// The name of a tag in one language: the members of a household can use
// different languages. A tag has at least one name.
export const tagNames = pgTable(
	"tag_names",
	{
		tagId: uuid().notNull(),
		householdId: uuid().notNull(),
		locale: text({ enum: LOCALES }).notNull(),
		name: text().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.tagId, table.locale] }),
		foreignKey({
			columns: [table.tagId, table.householdId],
			foreignColumns: [tags.id, tags.householdId],
		}).onDelete("cascade"),
		// To find a tag by its name, whatever its case. Not unique: a name
		// designates a single tag among the children of a same parent only, which
		// the service checks (the parent is on the tag, not here).
		// Named by hand: Drizzle can't name an index on an expression
		index("tag_names_household_id_locale_name_index").on(
			table.householdId,
			table.locale,
			sql`lower(${table.name})`,
		),
	],
);
