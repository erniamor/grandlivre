import {
	DEFAULT_HOUSEHOLD_TIME_ZONE,
	HOUSEHOLD_CURRENCIES,
} from "@repo/schemas";
import { boolean, pgTable, text } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "@/db/schema/columns";

// A family: everything the product stores (accounts, tags, transactions)
// belongs to a household
export const households = pgTable("households", {
	id: id(),
	name: text().notNull(),
	// ISO 4217 code; every amount of the household is in this currency
	currency: text({ enum: HOUSEHOLD_CURRENCIES }).notNull(),
	// IANA name: where its days start and end, for its recurring transactions
	timeZone: text().notNull().default(DEFAULT_HOUSEHOLD_TIME_ZONE),
	// Whether its members settle the expenses they share; off by default
	expenseSharing: boolean().notNull().default(false),
	// Made up to try the app or show it: its data is invented, and it can be
	// deleted whole by its owner, which no real household can
	demo: boolean().notNull().default(false),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});
