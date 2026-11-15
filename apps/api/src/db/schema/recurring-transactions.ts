import {
	RECURRENCE_MODES,
	RECURRENCE_UNITS,
	TRANSACTION_TYPES,
} from "@repo/schemas";
import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	date,
	foreignKey,
	index,
	integer,
	pgTable,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "@/db/schema/columns";
import { households } from "@/db/schema/households";
import { ledgerAccounts } from "@/db/schema/ledger-accounts";
import { users } from "@/db/schema/users";

// A transaction that repeats: what it records (the columns of a transaction,
// without its day) and when (from its first day, every `interval` units)
export const recurringTransactions = pgTable(
	"recurring_transactions",
	{
		id: id(),
		householdId: uuid()
			.notNull()
			.references(() => households.id, { onDelete: "cascade" }),
		type: text({ enum: TRANSACTION_TYPES }).notNull(),
		accountId: uuid().notNull(),
		toAccountId: uuid(),
		// Minor units; for an expense or an income, the sum of its lines
		amount: bigint({ mode: "number" }).notNull(),
		payee: text(),
		note: text(),
		unit: text({ enum: RECURRENCE_UNITS }).notNull(),
		interval: integer().notNull(),
		// Its first day: the day of the month or of the week it repeats on
		startDate: date({ mode: "string" }).notNull(),
		// Its last possible day, included; null when it never ends
		endDate: date({ mode: "string" }),
		mode: text({ enum: RECURRENCE_MODES }).notNull().default("confirm"),
		// Its next day not yet recorded or waiting; null once it has ended
		nextDate: date({ mode: "string" }),
		createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		index().on(table.householdId),
		// What is due, across households
		index().on(table.nextDate),
		unique().on(table.id, table.householdId),
		// The accounts belong to its household. An account can only be deleted
		// without transactions: its recurring transactions go with it.
		foreignKey({
			columns: [table.accountId, table.householdId],
			foreignColumns: [ledgerAccounts.id, ledgerAccounts.householdId],
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.toAccountId, table.householdId],
			foreignColumns: [ledgerAccounts.id, ledgerAccounts.householdId],
		}).onDelete("cascade"),
		check("recurring_transactions_amount_positive", sql`${table.amount} > 0`),
		check(
			"recurring_transactions_interval_positive",
			sql`${table.interval} > 0`,
		),
		check(
			"recurring_transactions_transfer_destination",
			sql`(${table.type} = 'transfer') = (${table.toAccountId} is not null) and ${table.toAccountId} is distinct from ${table.accountId}`,
		),
	],
);
