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
import { tags } from "@/db/schema/tags";
import { transactions } from "@/db/schema/transactions";

// The parts an expense or an income is split into: each has an amount and
// at most one tag, so reports never count an amount twice. Their sum is the
// transaction's amount (the service keeps it so). A transfer has no lines.
export const transactionLines = pgTable(
	"transaction_lines",
	{
		id: id(),
		transactionId: uuid().notNull(),
		householdId: uuid().notNull(),
		// The order in which the lines were entered
		position: integer().notNull(),
		// Minor units of the household's currency (cents)
		amount: bigint({ mode: "number" }).notNull(),
		// Null for an uncategorized line
		tagId: uuid(),
	},
	(table) => [
		index().on(table.transactionId),
		index().on(table.tagId),
		foreignKey({
			columns: [table.transactionId, table.householdId],
			foreignColumns: [transactions.id, transactions.householdId],
		}).onDelete("cascade"),
		// The tag belongs to the same household. No cascade: a tag that has
		// transactions can't be deleted.
		foreignKey({
			columns: [table.tagId, table.householdId],
			foreignColumns: [tags.id, tags.householdId],
		}),
		check("transaction_lines_amount_positive", sql`${table.amount} > 0`),
	],
);
