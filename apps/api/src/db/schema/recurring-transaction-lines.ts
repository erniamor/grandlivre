import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	index,
	integer,
	pgTable,
	uuid,
} from "drizzle-orm/pg-core";
import { id } from "@/db/schema/columns";
import { recurringTransactions } from "@/db/schema/recurring-transactions";
import { tags } from "@/db/schema/tags";

// The lines a recurring expense or income records each time, like those of
// a transaction
export const recurringTransactionLines = pgTable(
	"recurring_transaction_lines",
	{
		id: id(),
		recurringId: uuid().notNull(),
		householdId: uuid().notNull(),
		position: integer().notNull(),
		amount: bigint({ mode: "number" }).notNull(),
		// Null for an uncategorized line
		tagId: uuid(),
	},
	(table) => [
		index().on(table.recurringId),
		index().on(table.tagId),
		foreignKey({
			columns: [table.recurringId, table.householdId],
			foreignColumns: [
				recurringTransactions.id,
				recurringTransactions.householdId,
			],
		}).onDelete("cascade"),
		// No cascade: a tag a recurring transaction records on can't be deleted
		foreignKey({
			columns: [table.tagId, table.householdId],
			foreignColumns: [tags.id, tags.householdId],
		}),
		check(
			"recurring_transaction_lines_amount_positive",
			sql`${table.amount} > 0`,
		),
	],
);
