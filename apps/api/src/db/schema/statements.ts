import {
	foreignKey,
	index,
	pgTable,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id } from "@/db/schema/columns";
import { households } from "@/db/schema/households";
import { ledgerAccounts } from "@/db/schema/ledger-accounts";
import { transactions } from "@/db/schema/transactions";

// An account at the bank, as its statements name it, tied to an account of
// the household: its next statements go there without asking. Its number is
// never kept, only a keyed hash of it, and what helps the member recognize
// it (the bank's name for it, its last digits).
export const statementAccounts = pgTable(
	"statement_accounts",
	{
		id: id(),
		householdId: uuid()
			.notNull()
			.references(() => households.id, { onDelete: "cascade" }),
		accountId: uuid().notNull(),
		numberHash: text().notNull(),
		bankName: text().notNull(),
		numberEnd: text().notNull(),
		createdAt: createdAt(),
	},
	(table) => [
		unique().on(table.householdId, table.numberHash),
		index().on(table.accountId),
		// Goes with its account
		foreignKey({
			columns: [table.accountId, table.householdId],
			foreignColumns: [ledgerAccounts.id, ledgerAccounts.householdId],
		}).onDelete("cascade"),
	],
);

// A line of an account's statement, and the transaction it became or was
// found to be. A transfer between two accounts can be the line of each
// one's statement. The same line is never imported twice into an account;
// once its transaction is deleted, the line can be imported again.
export const statementLines = pgTable(
	"statement_lines",
	{
		id: id(),
		householdId: uuid().notNull(),
		accountId: uuid().notNull(),
		// The line's identity in the account's statements (see the readers)
		externalId: text().notNull(),
		transactionId: uuid().notNull(),
		createdAt: createdAt(),
	},
	(table) => [
		unique().on(table.accountId, table.externalId),
		index().on(table.transactionId),
		foreignKey({
			columns: [table.accountId, table.householdId],
			foreignColumns: [ledgerAccounts.id, ledgerAccounts.householdId],
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.transactionId, table.householdId],
			foreignColumns: [transactions.id, transactions.householdId],
		}).onDelete("cascade"),
	],
);
