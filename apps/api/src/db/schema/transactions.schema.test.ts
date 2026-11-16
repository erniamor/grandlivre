import { createTestHousehold, signInUser } from "@test/helpers/households";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import {
	households,
	ledgerAccounts,
	statementLines,
	tagNames,
	tags,
	transactionLines,
	transactions,
	users,
} from "@/db/schema";

/** A household with two accounts, a tag, and an expense of 72.00 on that tag. */
async function setUp() {
	const alice = await signInUser("alice@example.com");
	const { id: householdId } = await createTestHousehold(alice.cookie);
	const account = {
		householdId,
		type: "checking",
		visibility: "details",
	} as const;
	const [chequing, savings] = await db
		.insert(ledgerAccounts)
		.values([
			{ ...account, name: "Chequing", openingBalance: 100_000 },
			{ ...account, name: "Savings", openingBalance: 0 },
		])
		.returning();
	const [tag] = await db.insert(tags).values({ householdId }).returning();
	if (!chequing || !savings || !tag) {
		throw new Error("The test data was not created");
	}
	await db
		.insert(tagNames)
		.values({ tagId: tag.id, householdId, locale: "en", name: "Gas" });

	const expense = {
		householdId,
		type: "expense",
		date: "2026-11-14",
		accountId: chequing.id,
		amount: 7200,
		createdBy: alice.id,
	} as const;
	const [transaction] = await db
		.insert(transactions)
		.values(expense)
		.returning();
	if (!transaction) {
		throw new Error("The test data was not created");
	}
	await db.insert(transactionLines).values({
		transactionId: transaction.id,
		householdId,
		position: 0,
		amount: 7200,
		tagId: tag.id,
	});
	return { alice, householdId, chequing, savings, tag, transaction, expense };
}

describe("transactions tables", () => {
	it("keeps a date as a calendar day, and marks a transaction as manual by default", async () => {
		const { transaction } = await setUp();

		expect(transaction).toMatchObject({
			date: "2026-11-14",
			origin: "manual",
			toAccountId: null,
		});
	});

	it("refuses an amount that isn't positive, on a transaction or a line", async () => {
		const { householdId, transaction, expense } = await setUp();

		await expect(
			db.insert(transactions).values({ ...expense, amount: 0 }),
		).rejects.toThrow();
		await expect(
			db.insert(transactionLines).values({
				transactionId: transaction.id,
				householdId,
				position: 1,
				amount: -100,
			}),
		).rejects.toThrow();
	});

	it("gives a destination to transfers, and to transfers only", async () => {
		const { savings, chequing, expense } = await setUp();
		const transfer = { ...expense, type: "transfer" } as const;

		await expect(
			db.insert(transactions).values({ ...transfer, toAccountId: savings.id }),
		).resolves.toBeDefined();
		// A transfer without a destination, or back to the same account
		await expect(db.insert(transactions).values(transfer)).rejects.toThrow();
		await expect(
			db.insert(transactions).values({ ...transfer, toAccountId: chequing.id }),
		).rejects.toThrow();
		// An expense with a destination
		await expect(
			db.insert(transactions).values({ ...expense, toAccountId: savings.id }),
		).rejects.toThrow();
	});

	it("refuses an account or a tag of another household", async () => {
		const { alice, tag, transaction, chequing, expense } = await setUp();
		const other = await createTestHousehold(alice.cookie, "The Gagnons");

		await expect(
			db.insert(transactions).values({
				...expense,
				householdId: other.id,
				accountId: chequing.id,
			}),
		).rejects.toThrow();
		await expect(
			db.insert(transactionLines).values({
				transactionId: transaction.id,
				householdId: other.id,
				position: 1,
				amount: 100,
				tagId: tag.id,
			}),
		).rejects.toThrow();
	});

	it("doesn't import the same statement line twice into an account", async () => {
		const { householdId, chequing, savings, transaction } = await setUp();
		const line = {
			householdId,
			accountId: chequing.id,
			externalId: "a1b2-0",
			transactionId: transaction.id,
		};
		await db.insert(statementLines).values(line);

		await expect(db.insert(statementLines).values(line)).rejects.toThrow();
		// The same line on another account: the other side of a transfer
		await expect(
			db.insert(statementLines).values({ ...line, accountId: savings.id }),
		).resolves.toBeDefined();
	});

	it("frees a statement line when its transaction is deleted", async () => {
		const { householdId, chequing, transaction } = await setUp();
		await db.insert(statementLines).values({
			householdId,
			accountId: chequing.id,
			externalId: "a1b2-0",
			transactionId: transaction.id,
		});

		await db.delete(transactions).where(eq(transactions.id, transaction.id));

		expect(await db.select().from(statementLines)).toEqual([]);
	});

	it("keeps an account and a tag that have transactions from being deleted", async () => {
		const { chequing, savings, tag } = await setUp();

		await expect(
			db.delete(ledgerAccounts).where(eq(ledgerAccounts.id, chequing.id)),
		).rejects.toThrow();
		await expect(db.delete(tags).where(eq(tags.id, tag.id))).rejects.toThrow();
		// An account without transactions still goes
		await expect(
			db.delete(ledgerAccounts).where(eq(ledgerAccounts.id, savings.id)),
		).resolves.toBeDefined();
	});

	it("deletes the lines with their transaction, and everything with the household", async () => {
		const { householdId, transaction } = await setUp();
		const linesOf = () =>
			db
				.select()
				.from(transactionLines)
				.where(eq(transactionLines.householdId, householdId));

		await db.delete(transactions).where(eq(transactions.id, transaction.id));
		expect(await linesOf()).toEqual([]);

		await db.insert(transactions).values({
			householdId,
			type: "expense",
			date: "2026-11-15",
			accountId: transaction.accountId,
			amount: 100,
		});
		await db.delete(households).where(eq(households.id, householdId));
		expect(
			await db
				.select()
				.from(transactions)
				.where(eq(transactions.householdId, householdId)),
		).toEqual([]);
	});

	it("keeps a transaction when the user who recorded it is gone", async () => {
		const { householdId, chequing } = await setUp();
		const bob = await signInUser("bob@example.com");
		const [byBob] = await db
			.insert(transactions)
			.values({
				householdId,
				type: "income",
				date: "2026-11-15",
				accountId: chequing.id,
				amount: 100,
				createdBy: bob.id,
			})
			.returning();

		await db.delete(users).where(eq(users.id, bob.id));

		const [kept] = await db
			.select()
			.from(transactions)
			.where(eq(transactions.id, byBob?.id ?? ""));
		expect(kept).toMatchObject({ amount: 100, createdBy: null });
	});
});
