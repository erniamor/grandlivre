import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	date,
	foreignKey,
	index,
	integer,
	pgTable,
	primaryKey,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id } from "@/db/schema/columns";
import { households } from "@/db/schema/households";
import { transactions } from "@/db/schema/transactions";
import { users } from "@/db/schema/users";

// Settling shared expenses, for the households that turn it on

// Each member's part of a shared transaction, in minor units: they add up
// to its amount. Who paid is the holder of its account.
export const transactionShares = pgTable(
	"transaction_shares",
	{
		id: id(),
		transactionId: uuid().notNull(),
		householdId: uuid().notNull(),
		// Kept when the member leaves the household: their part still counts
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		amount: bigint({ mode: "number" }).notNull(),
	},
	(table) => [
		unique().on(table.transactionId, table.userId),
		index().on(table.householdId),
		foreignKey({
			columns: [table.transactionId, table.householdId],
			foreignColumns: [transactions.id, transactions.householdId],
		}).onDelete("cascade"),
		check("transaction_shares_amount", sql`${table.amount} >= 0`),
	],
);

// The household's default split: a weight per member, 1 when never set
export const sharingWeights = pgTable(
	"sharing_weights",
	{
		householdId: uuid()
			.notNull()
			.references(() => households.id, { onDelete: "cascade" }),
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		weight: integer().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.householdId, table.userId] }),
		check("sharing_weights_weight", sql`${table.weight} >= 0`),
	],
);

// A payment from one member to another that settles what they owe; with
// the transfer between their accounts it was recorded as, if any
export const settlements = pgTable(
	"settlements",
	{
		id: id(),
		householdId: uuid()
			.notNull()
			.references(() => households.id, { onDelete: "cascade" }),
		fromUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		toUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		amount: bigint({ mode: "number" }).notNull(),
		date: date({ mode: "string" }).notNull(),
		note: text(),
		// Deleting the transfer deletes the settlement it records
		transactionId: uuid().references(() => transactions.id, {
			onDelete: "cascade",
		}),
		createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
		createdAt: createdAt(),
	},
	(table) => [
		index().on(table.householdId, table.date.desc()),
		check("settlements_amount_positive", sql`${table.amount} > 0`),
		check(
			"settlements_two_members",
			sql`${table.fromUserId} <> ${table.toUserId}`,
		),
	],
);
