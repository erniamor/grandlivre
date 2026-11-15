import { OCCURRENCE_STATUSES } from "@repo/schemas";
import {
	date,
	foreignKey,
	index,
	pgTable,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "@/db/schema/columns";
import { recurringTransactions } from "@/db/schema/recurring-transactions";
import { transactions } from "@/db/schema/transactions";

// Each day a recurring transaction came due, and what became of it: recorded
// (automatically or once confirmed), waiting for a member, or skipped. Its
// uniqueness is what keeps a day from being recorded twice, whatever runs.
export const recurringOccurrences = pgTable(
	"recurring_occurrences",
	{
		id: id(),
		recurringId: uuid().notNull(),
		householdId: uuid().notNull(),
		date: date({ mode: "string" }).notNull(),
		status: text({ enum: OCCURRENCE_STATUSES }).notNull(),
		// The transaction recorded; null while waiting, when skipped, or once
		// the transaction is deleted
		transactionId: uuid().references(() => transactions.id, {
			onDelete: "set null",
		}),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		unique().on(table.recurringId, table.date),
		// What waits for a member, in a household
		index().on(table.householdId, table.status),
		foreignKey({
			columns: [table.recurringId, table.householdId],
			foreignColumns: [
				recurringTransactions.id,
				recurringTransactions.householdId,
			],
		}).onDelete("cascade"),
	],
);
