import {
	foreignKey,
	index,
	pgTable,
	primaryKey,
	uuid,
} from "drizzle-orm/pg-core";
import { createdAt } from "@/db/schema/columns";
import { householdMembers } from "@/db/schema/household-members";
import { ledgerAccounts } from "@/db/schema/ledger-accounts";

// The members who hold an account: one for a personal account, several for a
// shared one. The two foreign keys guarantee that a holder is a member of the
// account's household, and remove the row when they leave it: an account can
// end up without a holder, until an owner of the household gives it one.
export const ledgerAccountHolders = pgTable(
	"ledger_account_holders",
	{
		accountId: uuid().notNull(),
		householdId: uuid().notNull(),
		userId: uuid().notNull(),
		createdAt: createdAt(),
	},
	(table) => [
		primaryKey({ columns: [table.accountId, table.userId] }),
		foreignKey({
			columns: [table.accountId, table.householdId],
			foreignColumns: [ledgerAccounts.id, ledgerAccounts.householdId],
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.householdId, table.userId],
			foreignColumns: [householdMembers.householdId, householdMembers.userId],
		}).onDelete("cascade"),
		index().on(table.householdId, table.userId),
	],
);
