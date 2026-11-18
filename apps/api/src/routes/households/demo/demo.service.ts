import { randomUUID } from "node:crypto";
import {
	type CreateDemoHousehold,
	DEFAULT_HOUSEHOLD_TIME_ZONE,
	type Household,
} from "@repo/schemas";
import { and, eq, inArray } from "drizzle-orm";
import { db, type Transaction as Tx } from "@/db/client";
import {
	budgets,
	householdMembers,
	households,
	ledgerAccountHolders,
	ledgerAccounts,
	recurringOccurrences,
	recurringTransactionLines,
	recurringTransactions,
	transactionLines,
	transactions,
} from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { publishHouseholdEvent } from "@/lib/events";
import type { Locale } from "@/lib/locale";
import {
	type DemoAccountRef,
	demoPlan,
} from "@/routes/households/demo/demo-plan";
import {
	type Membership,
	toHousehold,
} from "@/routes/households/households.service";
import { insertSuggestedTags } from "@/routes/tags/tags.service";

/** Rows written at once: far below PostgreSQL's limit of parameters. */
const CHUNK = 500;

function chunks<T>(items: T[]): T[][] {
	return Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, index) =>
		items.slice(index * CHUNK, (index + 1) * CHUNK),
	);
}

/**
 * Deletes households and everything in them. The lines go first: their tags
 * hold them without a cascade (a tag in use can't be deleted), the rest
 * follows its household.
 */
async function deleteHouseholds(tx: Tx, ids: string[]): Promise<void> {
	await tx
		.delete(transactionLines)
		.where(inArray(transactionLines.householdId, ids));
	await tx
		.delete(recurringTransactionLines)
		.where(inArray(recurringTransactionLines.householdId, ids));
	await tx.delete(households).where(inArray(households.id, ids));
}

/** Deletes the demo households `userId` owns: each person has one at most. */
async function deleteDemosOf(tx: Tx, userId: string): Promise<void> {
	const owned = await tx
		.select({ id: households.id })
		.from(households)
		.innerJoin(
			householdMembers,
			eq(householdMembers.householdId, households.id),
		)
		.where(
			and(
				eq(households.demo, true),
				eq(householdMembers.userId, userId),
				eq(householdMembers.role, "owner"),
			),
		);
	if (owned.length > 0) {
		await deleteHouseholds(
			tx,
			owned.map(({ id }) => id),
		);
	}
}

/**
 * Makes `userId` a demo household of made-up data (see demoPlan), named in
 * their language, in one database transaction: its accounts, suggested
 * tags, about six months of transactions, recurring ones (a day waiting to
 * be confirmed) and budgets. It replaces their demo household, if any.
 */
export async function createDemoHousehold(
	userId: string,
	{
		currency = "CAD",
		timeZone = DEFAULT_HOUSEHOLD_TIME_ZONE,
	}: CreateDemoHousehold,
	locale: Locale,
): Promise<Household> {
	const plan = demoPlan(todayIn(timeZone), locale);
	return db.transaction(async (tx) => {
		await deleteDemosOf(tx, userId);
		const [household] = await tx
			.insert(households)
			.values({ name: plan.name, currency, timeZone, demo: true })
			.returning();
		if (!household) {
			throw new Error("The demo household was not created");
		}
		const householdId = household.id;
		await tx
			.insert(householdMembers)
			.values({ householdId, userId, role: "owner" });

		const accountOf = new Map<DemoAccountRef, string>(
			plan.accounts.map((account) => [account.ref, randomUUID()]),
		);
		const accountId = (ref: DemoAccountRef) => accountOf.get(ref) as string;
		await tx.insert(ledgerAccounts).values(
			plan.accounts.map((account) => ({
				id: accountId(account.ref),
				householdId,
				name: account.name,
				type: account.type,
				visibility: "details" as const,
				openingBalance: account.openingBalance,
			})),
		);
		await tx.insert(ledgerAccountHolders).values(
			plan.accounts.map((account) => ({
				accountId: accountId(account.ref),
				householdId,
				userId,
			})),
		);

		const tagOf = await insertSuggestedTags(tx, householdId, plan.tagKeys);
		const tagId = (key: string | null) =>
			key === null ? null : (tagOf.get(key) ?? null);

		const rows = plan.transactions.map((each) => ({
			id: randomUUID(),
			householdId,
			type: each.type,
			date: each.date,
			accountId: accountId(each.account),
			toAccountId: each.toAccount ? accountId(each.toAccount) : null,
			amount: each.amount,
			payee: each.payee,
			createdBy: userId,
			tagKey: each.tagKey,
		}));
		for (const part of chunks(rows)) {
			await tx
				.insert(transactions)
				.values(part.map(({ tagKey: _tagKey, ...row }) => row));
		}
		const lines = rows
			.filter((row) => row.type !== "transfer")
			.map((row) => ({
				transactionId: row.id,
				householdId,
				position: 0,
				amount: row.amount,
				tagId: tagId(row.tagKey),
			}));
		for (const part of chunks(lines)) {
			await tx.insert(transactionLines).values(part);
		}

		for (const each of plan.recurring) {
			const [row] = await tx
				.insert(recurringTransactions)
				.values({
					householdId,
					type: each.type,
					accountId: accountId(each.account),
					toAccountId: each.toAccount ? accountId(each.toAccount) : null,
					amount: each.amount,
					payee: each.payee,
					unit: each.unit,
					interval: 1,
					startDate: each.startDate,
					mode: each.mode,
					nextDate: each.nextDate,
					createdBy: userId,
				})
				.returning({ id: recurringTransactions.id });
			if (!row) {
				throw new Error("The recurring transaction was not created");
			}
			if (each.type !== "transfer") {
				await tx.insert(recurringTransactionLines).values({
					recurringId: row.id,
					householdId,
					position: 0,
					amount: each.amount,
					tagId: tagId(each.tagKey),
				});
			}
			if (each.pendingDate) {
				await tx.insert(recurringOccurrences).values({
					recurringId: row.id,
					householdId,
					date: each.pendingDate,
					status: "pending",
				});
			}
		}

		await tx.insert(budgets).values(
			plan.budgets.map((budget) => ({
				householdId,
				tagId: tagId(budget.tagKey) as string,
				period: "month" as const,
				amount: budget.amount,
				fromMonth: budget.fromMonth,
				updatedBy: userId,
			})),
		);
		return toHousehold({ household, role: "owner" });
	});
}

/**
 * Deletes a demo household, and everything in it, at its owner's request.
 * A real household can't be deleted: its history is kept.
 */
export async function deleteDemoHousehold({
	household,
}: Membership): Promise<void> {
	if (!household.demo) {
		throw new AppError(
			409,
			"household_not_demo",
			"Only a demo household can be deleted",
		);
	}
	await db.transaction(async (tx) => {
		// Its members' pages leave it: they go back to another household
		await publishHouseholdEvent(tx, household.id, "members");
		await deleteHouseholds(tx, [household.id]);
	});
}
