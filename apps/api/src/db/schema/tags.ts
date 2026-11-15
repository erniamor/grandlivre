import { foreignKey, index, pgTable, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "@/db/schema/columns";
import { households } from "@/db/schema/households";

// The categories of a household's transactions, as a tree: a tag has at most
// one parent. Its names, one per language, are in `tag_names`.
export const tags = pgTable(
	"tags",
	{
		id: id(),
		householdId: uuid()
			.notNull()
			.references(() => households.id, { onDelete: "cascade" }),
		// Null for a tag at the root
		parentId: uuid(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		index().on(table.householdId),
		// Target of the foreign keys that tie a row to a tag of its own household
		unique().on(table.id, table.householdId),
		// The parent is a tag of the same household. No cascade: a tag that
		// has child tags can't be deleted.
		foreignKey({
			columns: [table.parentId, table.householdId],
			foreignColumns: [table.id, table.householdId],
		}),
	],
);
