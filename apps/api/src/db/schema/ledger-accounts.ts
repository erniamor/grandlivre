import { ACCOUNT_TYPES, ACCOUNT_VISIBILITIES } from "@repo/schemas";
import {
	bigint,
	index,
	pgTable,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "@/db/schema/columns";
import { households } from "@/db/schema/households";

// The financial accounts of a household (chequing, savings, credit card...).
// Named "ledger accounts": `accounts` is Better Auth's table of sign-in providers.
export const ledgerAccounts = pgTable(
	"ledger_accounts",
	{
		id: id(),
		householdId: uuid()
			.notNull()
			.references(() => households.id, { onDelete: "cascade" }),
		name: text().notNull(),
		type: text({ enum: ACCOUNT_TYPES }).notNull(),
		// What the members who don't hold the account see of it
		visibility: text({ enum: ACCOUNT_VISIBILITIES }).notNull(),
		// Minor units of the household's currency (cents), negative for money
		// owed. The current balance is never stored: it is this plus the transactions.
		openingBalance: bigint({ mode: "number" }).notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		index().on(table.householdId),
		// Target of the holders' foreign key, which ties a holder to the
		// account's own household
		unique().on(table.id, table.householdId),
	],
);
