import { RECURRENCE_UNITS, TRANSACTION_TYPES } from "@repo/schemas";
import {
	date,
	foreignKey,
	index,
	integer,
	pgTable,
	text,
	uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id } from "@/db/schema/columns";
import { households } from "@/db/schema/households";
import { ledgerAccounts } from "@/db/schema/ledger-accounts";
import { users } from "@/db/schema/users";

// A series found in the history that a member said doesn't repeat: it is
// no longer suggested as a recurring transaction. Named as a suggestion
// names it: its accounts, type, payee key and cadence, from the day it was
// next expected (so a pay on the 15th dismissed leaves the one on the 30th).
export const recurringDismissals = pgTable(
	"recurring_dismissals",
	{
		id: id(),
		householdId: uuid()
			.notNull()
			.references(() => households.id, { onDelete: "cascade" }),
		accountId: uuid().notNull(),
		toAccountId: uuid(),
		type: text({ enum: TRANSACTION_TYPES }).notNull(),
		// The payee's letters, lowercased (see descriptionKey)
		key: text().notNull(),
		unit: text({ enum: RECURRENCE_UNITS }).notNull(),
		interval: integer().notNull(),
		startDate: date({ mode: "string" }).notNull(),
		dismissedBy: uuid().references(() => users.id, { onDelete: "set null" }),
		createdAt: createdAt(),
	},
	(table) => [
		index().on(table.householdId),
		// Goes with its accounts
		foreignKey({
			columns: [table.accountId, table.householdId],
			foreignColumns: [ledgerAccounts.id, ledgerAccounts.householdId],
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.toAccountId, table.householdId],
			foreignColumns: [ledgerAccounts.id, ledgerAccounts.householdId],
		}).onDelete("cascade"),
	],
);
