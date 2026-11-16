import {
	type Receipt,
	type ShareSplit,
	TRANSACTION_ORIGINS,
	TRANSACTION_TYPES,
} from "@repo/schemas";
import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	date,
	foreignKey,
	index,
	jsonb,
	pgTable,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "@/db/schema/columns";
import { households } from "@/db/schema/households";
import { ledgerAccounts } from "@/db/schema/ledger-accounts";
import { users } from "@/db/schema/users";

// Money entering an account (income), leaving it (expense) or moving to
// another account of the household (transfer). The amount is always positive:
// the type says which way the money goes.
export const transactions = pgTable(
	"transactions",
	{
		id: id(),
		householdId: uuid()
			.notNull()
			.references(() => households.id, { onDelete: "cascade" }),
		type: text({ enum: TRANSACTION_TYPES }).notNull(),
		// The day of the transaction: a calendar day, without time zone
		date: date({ mode: "string" }).notNull(),
		// The account the money leaves (expense, transfer) or enters (income)
		accountId: uuid().notNull(),
		// The account the money enters, for a transfer
		toAccountId: uuid(),
		// Minor units of the household's currency (cents). For an expense or
		// an income, the sum of its lines.
		amount: bigint({ mode: "number" }).notNull(),
		payee: text(),
		note: text(),
		// Its statement lines, when it was imported or found on one, are in
		// statement_lines
		origin: text({ enum: TRANSACTION_ORIGINS }).notNull().default("manual"),
		// What its receipt said, when it was recorded from one; the photo itself
		// is never stored
		receipt: jsonb().$type<Receipt>(),
		// How it is shared among members, as given; the parts are in
		// transaction_shares
		shareSplit: jsonb().$type<ShareSplit>(),
		// Who paid it (or received it), when shared: its account's holder then
		sharePaidBy: uuid().references(() => users.id, { onDelete: "set null" }),
		// Who recorded it; kept when they leave the household
		createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		// The household's transactions, most recent first
		index().on(table.householdId, table.date.desc(), table.id),
		index().on(table.accountId),
		index().on(table.toAccountId),
		// Target of the lines' foreign key, which ties a line to the
		// transaction's own household
		unique().on(table.id, table.householdId),
		// Both accounts belong to the transaction's household. No cascade: an
		// account that has transactions can't be deleted, only archived.
		foreignKey({
			columns: [table.accountId, table.householdId],
			foreignColumns: [ledgerAccounts.id, ledgerAccounts.householdId],
		}),
		foreignKey({
			columns: [table.toAccountId, table.householdId],
			foreignColumns: [ledgerAccounts.id, ledgerAccounts.householdId],
		}),
		check("transactions_amount_positive", sql`${table.amount} > 0`),
		// A transfer, and only a transfer, has a destination: another account
		check(
			"transactions_transfer_destination",
			sql`(${table.type} = 'transfer') = (${table.toAccountId} is not null) and ${table.toAccountId} is distinct from ${table.accountId}`,
		),
	],
);
