import { LOCALES } from "@repo/schemas";
import { sql } from "drizzle-orm";
import {
	foreignKey,
	pgTable,
	primaryKey,
	text,
	uniqueIndex,
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
		// In a household, a name designates a single tag in a given language,
		// whatever its case
		// Named by hand: Drizzle can't name an index on an expression
		uniqueIndex("tag_names_household_id_locale_name_unique").on(
			table.householdId,
			table.locale,
			sql`lower(${table.name})`,
		),
	],
);
