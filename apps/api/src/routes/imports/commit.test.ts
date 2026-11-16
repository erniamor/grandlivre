import type {
	Paginated,
	StatementImport,
	StatementPreview,
	StatementPreviewLine,
	Transaction,
} from "@repo/schemas";
import { api, json } from "@test/helpers/api";
import {
	addTestMember,
	createTestHousehold,
	signInUser,
	type TestUser,
} from "@test/helpers/households";
import { october, postStatement, savingsSide } from "@test/helpers/statements";
import { householdApi } from "@test/helpers/transactions";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import {
	recurringOccurrences,
	recurringTransactionLines,
	recurringTransactions,
} from "@/db/schema";

/**
 * Alice holds the everyday account, a savings account, a card and her
 * wallet; Bob, a member, holds his own account; Carol is outside.
 */
async function setUp() {
	const alice = await signInUser("alice@example.com");
	const bob = await signInUser("bob@example.com");
	const carol = await signInUser("carol@example.com");
	const household = await createTestHousehold(alice.cookie);
	await addTestMember(household.id, bob.id);
	const h = householdApi(household.id);
	const everyday = await h.account(alice, {
		name: "Everyday",
		openingBalance: 5_000_00,
	});
	const savings = await h.account(alice, {
		name: "Savings",
		type: "savings",
		openingBalance: 10_000_00,
	});
	const card = await h.account(alice, {
		name: "Visa",
		type: "credit_card",
		openingBalance: 0,
	});
	const wallet = await h.account(alice, {
		name: "Wallet",
		type: "cash",
		openingBalance: 0,
	});
	const bobs = await h.account(bob, { name: "Bob's" });
	const fuel = await h.tag(alice, "Fuel");
	const home = await h.tag(alice, "Home");

	const preview = async (user: TestUser, file: string, targets?: unknown) =>
		json<StatementPreview>(
			await postStatement(`${h.base}/imports/preview`, user, file, { targets }),
		);
	const importIt = (user: TestUser | undefined, file: string, plan: unknown) =>
		postStatement(`${h.base}/imports`, user, file, { plan });
	const transactionsOf = async (user: TestUser) =>
		(
			await json<Paginated<Transaction>>(
				await api(`${h.base}/transactions?pageSize=100`, {
					cookie: user.cookie,
				}),
			)
		).data;
	const balanceOf = async (accountId: string) =>
		(await h.getAccount(alice, accountId)).balance;

	/** A waiting day of a monthly mortgage of 1 500.00, on the 20th, tagged Home. */
	const mortgageDay = async () => {
		const [rule] = await db
			.insert(recurringTransactions)
			.values({
				householdId: household.id,
				type: "expense",
				accountId: everyday.id,
				amount: 1_500_00,
				payee: "Mortgage",
				unit: "month",
				interval: 1,
				startDate: "2026-09-20",
				nextDate: "2026-11-20",
				createdBy: alice.id,
			})
			.returning();
		if (!rule) {
			throw new Error("The test data was not created");
		}
		await db.insert(recurringTransactionLines).values({
			recurringId: rule.id,
			householdId: household.id,
			position: 0,
			amount: 1_500_00,
			tagId: home.id,
		});
		const [day] = await db
			.insert(recurringOccurrences)
			.values({
				recurringId: rule.id,
				householdId: household.id,
				date: "2026-10-20",
				status: "pending",
			})
			.returning();
		if (!day) {
			throw new Error("The test data was not created");
		}
		return day;
	};
	return {
		alice,
		bob,
		carol,
		h,
		everyday,
		savings,
		card,
		wallet,
		bobs,
		fuel,
		home,
		preview,
		importIt,
		transactionsOf,
		balanceOf,
		mortgageDay,
	};
}

/** The line of a payee, the first or the `nth`. */
function lineOf(
	preview: StatementPreview,
	payee: string,
	index = 0,
	nth = 0,
): StatementPreviewLine {
	const line = preview.accounts[index]?.lines.filter(
		(each) => each.payee === payee,
	)[nth];
	if (!line) {
		throw new Error(`No line for ${payee}`);
	}
	return line;
}

describe("POST /v1/households/:householdId/imports", () => {
	it("records new lines as expenses and incomes on their tags, and remembers the account", async () => {
		const { alice, everyday, fuel, preview, importIt, transactionsOf } =
			await setUp();
		const before = await preview(alice, october, [
			{ index: 0, accountId: everyday.id },
		]);

		const response = await importIt(alice, october, {
			accounts: [
				{
					index: 0,
					target: { accountId: everyday.id },
					lines: [
						{
							externalId: lineOf(before, "ESSENCE DU COIN").externalId,
							action: "create",
							tagId: fuel.id,
						},
						{
							externalId: lineOf(before, "EMPLOYEUR INC.").externalId,
							action: "create",
							payee: "Employer",
							note: "October's pay",
						},
					],
				},
			],
		});

		expect(response.status).toBe(201);
		expect(await response.json()).toMatchObject({
			format: "desjardins_accounts",
			createdBy: { userId: alice.id },
			accounts: [
				{ accountId: everyday.id, created: 2, linked: 0, confirmed: 0 },
			],
		});
		const recorded = await transactionsOf(alice);
		expect(recorded).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "expense",
					date: "2026-10-01",
					amount: 60_50,
					payee: "ESSENCE DU COIN",
					origin: "import",
					lines: [expect.objectContaining({ amount: 60_50, tagId: fuel.id })],
				}),
				expect.objectContaining({
					type: "income",
					date: "2026-10-15",
					amount: 2_000_00,
					payee: "Employer",
					note: "October's pay",
				}),
			]),
		);
		// Next time, the account is known and these lines are in
		const after = await preview(alice, october);
		expect(after.accounts[0]).toMatchObject({
			accountId: everyday.id,
			recognized: true,
		});
		expect(lineOf(after, "ESSENCE DU COIN").status).toBe("imported");
		expect(lineOf(after, "CAFE").status).toBe("new");
	});

	it("records transfers: cash taken out, a card paid, one transfer seen from both accounts", async () => {
		const {
			alice,
			everyday,
			savings,
			card,
			wallet,
			preview,
			importIt,
			balanceOf,
		} = await setUp();
		const file = `${october}\r\n${savingsSide}`;
		const before = await preview(alice, file, [
			{ index: 0, accountId: everyday.id },
			{ index: 1, accountId: savings.id },
		]);
		const [savingsLine] = before.accounts[1]?.lines ?? [];

		const response = await importIt(alice, file, {
			accounts: [
				{
					index: 0,
					target: { accountId: everyday.id },
					lines: [
						{
							externalId: lineOf(before, "CD PLATEAU").externalId,
							action: "transfer",
							accountId: wallet.id,
						},
						{
							externalId: lineOf(before, "Remises Visa Desjardins").externalId,
							action: "transfer",
							accountId: card.id,
						},
						{
							externalId: lineOf(before, "à 654321 EOP").externalId,
							action: "transfer",
							pair: { index: 1, externalId: savingsLine?.externalId },
						},
					],
				},
				{ index: 1, target: { accountId: savings.id }, lines: [] },
			],
		});

		expect(response.status).toBe(201);
		expect(await balanceOf(everyday.id)).toBe(
			5_000_00 - 100_00 - 250_00 - 300_00,
		);
		expect(await balanceOf(wallet.id)).toBe(100_00);
		expect(await balanceOf(card.id)).toBe(250_00);
		expect(await balanceOf(savings.id)).toBe(10_300_00);
		// Both sides are in: neither will be imported again
		const after = await preview(alice, file);
		expect(lineOf(after, "à 654321 EOP").status).toBe("imported");
		expect(after.accounts[1]?.lines[0]?.status).toBe("imported");
	});

	it("ties lines to what is already there, and records the recurring days waiting", async () => {
		const { alice, h, everyday, home, preview, importIt, mortgageDay } =
			await setUp();
		const coffee = await h.created(alice, {
			type: "expense",
			accountId: everyday.id,
			date: "2026-10-22",
			payee: "Coffee",
			lines: [{ amount: 4_25 }],
		});
		const day = await mortgageDay();
		const before = await preview(alice, october, [
			{ index: 0, accountId: everyday.id },
		]);

		const response = await importIt(alice, october, {
			accounts: [
				{
					index: 0,
					target: { accountId: everyday.id },
					lines: [
						{
							externalId: lineOf(before, "CAFE").externalId,
							action: "link",
							transactionId: coffee.id,
						},
						{
							externalId: lineOf(before, "BANQUE EXEMPLE").externalId,
							action: "confirm",
							occurrenceId: day.id,
						},
					],
				},
			],
		});

		expect(response.status).toBe(201);
		expect(await response.json()).toMatchObject({
			accounts: [{ created: 0, linked: 1, confirmed: 1 }],
		});
		const [recorded] = await db
			.select()
			.from(recurringOccurrences)
			.where(eq(recurringOccurrences.id, day.id));
		expect(recorded?.status).toBe("recorded");
		const mortgage = await json<Transaction>(
			await h.get(alice, recorded?.transactionId ?? ""),
		);
		expect(mortgage).toMatchObject({
			date: "2026-10-20",
			amount: 1_500_00,
			payee: "Mortgage",
			origin: "recurring",
			lines: [expect.objectContaining({ tagId: home.id })],
		});
		// The coffee noted stays as it was
		expect(
			await json<Transaction>(await h.get(alice, coffee.id)),
		).toMatchObject({
			payee: "Coffee",
			origin: "manual",
		});
		const after = await preview(alice, october);
		expect(lineOf(after, "CAFE", 0, 0).status).toBe("imported");
		expect(lineOf(after, "CAFE", 0, 1).status).toBe("new");
		expect(lineOf(after, "BANQUE EXEMPLE").status).toBe("imported");
	});

	it("makes the account from the statement, which ends with the bank's balance", async () => {
		const { alice, preview, importIt, balanceOf } = await setUp();
		const before = await preview(alice, october);
		const [statementAccount] = before.accounts;

		const response = await importIt(alice, october, {
			accounts: [
				{
					index: 0,
					target: {
						create: {
							name: "Plateau",
							type: statementAccount?.type,
							visibility: "details",
							openingBalance: statementAccount?.openingBalance,
						},
					},
					lines: statementAccount?.lines.map((line) => ({
						externalId: line.externalId,
						action: "create",
					})),
				},
			],
		});

		expect(response.status).toBe(201);
		const { accounts } = await json<StatementImport>(response);
		const accountId = accounts[0]?.accountId ?? "";
		expect(accounts[0]?.created).toBe(8);
		expect(await balanceOf(accountId)).toBe(statementAccount?.closingBalance);
		expect((await preview(alice, october)).accounts[0]).toMatchObject({
			accountId,
			recognized: true,
		});
	});

	it("imports nothing at all when a decision can't be followed", async () => {
		const { alice, h, everyday, bobs, preview, importIt, transactionsOf } =
			await setUp();
		const elsewhere = await h.created(alice, {
			type: "expense",
			accountId: everyday.id,
			date: "2026-10-22",
			lines: [{ amount: 9_99 }],
		});
		const before = await preview(alice, october, [
			{ index: 0, accountId: everyday.id },
		]);
		const fuelLine = lineOf(before, "ESSENCE DU COIN").externalId;
		const plan = (
			lines: unknown[],
			target: unknown = { accountId: everyday.id },
		) => ({
			accounts: [{ index: 0, target, lines }],
		});
		const create = { externalId: fuelLine, action: "create" };

		const cases: [unknown, string][] = [
			// A transaction of another amount
			[
				plan([
					create,
					{
						externalId: lineOf(before, "CAFE").externalId,
						action: "link",
						transactionId: elsewhere.id,
					},
				]),
				"accounts.0.lines.1.transactionId",
			],
			[
				plan([{ ...create, externalId: "not-a-line-0" }]),
				"accounts.0.lines.0.externalId",
			],
			[plan([create, create]), "accounts.0.lines.1.externalId"],
			[
				plan([{ ...create, tagId: "00000000-0000-4000-8000-000000000001" }]),
				"accounts.0.lines.0.tagId",
			],
			[plan([create], { accountId: bobs.id }), "accounts.0.target"],
			// The pay came in: a transfer from Bob's account, which Alice doesn't hold
			[
				plan([
					{
						externalId: lineOf(before, "EMPLOYEUR INC.").externalId,
						action: "transfer",
						accountId: bobs.id,
					},
				]),
				"accounts.0.lines.0.accountId",
			],
		];
		for (const [body, field] of cases) {
			const response = await importIt(alice, october, body);
			expect(response.status).toBe(422);
			expect(await response.json()).toMatchObject({
				error: { details: [{ field }] },
			});
		}
		expect(await transactionsOf(alice)).toHaveLength(1);

		expect((await importIt(alice, october, plan([create]))).status).toBe(201);
		const again = await importIt(alice, october, plan([create]));
		expect(again.status).toBe(409);
		expect(await again.json()).toMatchObject({
			error: { code: "statement_line_already_imported" },
		});
		expect((await importIt(alice, october, "{not json")).status).toBe(422);
	});

	it("hides the household from outsiders and requires a session", async () => {
		const { carol, everyday, importIt } = await setUp();
		const plan = {
			accounts: [{ index: 0, target: { accountId: everyday.id }, lines: [] }],
		};

		expect((await importIt(carol, october, plan)).status).toBe(404);
		expect((await importIt(undefined, october, plan)).status).toBe(401);
	});
});

describe("GET and DELETE /v1/households/:householdId/imports", () => {
	it("lists the member's imports, and undoes one: what it made goes, what it tied stays", async () => {
		const {
			alice,
			bob,
			h,
			everyday,
			preview,
			importIt,
			transactionsOf,
			mortgageDay,
		} = await setUp();
		const coffee = await h.created(alice, {
			type: "expense",
			accountId: everyday.id,
			date: "2026-10-22",
			lines: [{ amount: 4_25 }],
		});
		const day = await mortgageDay();
		const before = await preview(alice, october, [
			{ index: 0, accountId: everyday.id },
		]);
		const made = await json<StatementImport>(
			await importIt(alice, october, {
				accounts: [
					{
						index: 0,
						target: { accountId: everyday.id },
						lines: [
							{
								externalId: lineOf(before, "ESSENCE DU COIN").externalId,
								action: "create",
							},
							{
								externalId: lineOf(before, "CAFE").externalId,
								action: "link",
								transactionId: coffee.id,
							},
							{
								externalId: lineOf(before, "BANQUE EXEMPLE").externalId,
								action: "confirm",
								occurrenceId: day.id,
							},
						],
					},
				],
			}),
		);
		const list = async (user: TestUser) =>
			json<Paginated<StatementImport>>(
				await api(`${h.base}/imports`, { cookie: user.cookie }),
			);

		expect((await list(alice)).data).toEqual([made]);
		expect((await list(bob)).data).toEqual([]);
		expect(
			(
				await api(`${h.base}/imports/${made.id}`, {
					method: "DELETE",
					cookie: bob.cookie,
				})
			).status,
		).toBe(404);

		const undone = await api(`${h.base}/imports/${made.id}`, {
			method: "DELETE",
			cookie: alice.cookie,
		});

		expect(undone.status).toBe(204);
		expect((await list(alice)).data).toEqual([]);
		expect((await transactionsOf(alice)).map((each) => each.id)).toEqual([
			coffee.id,
		]);
		const [waiting] = await db
			.select()
			.from(recurringOccurrences)
			.where(eq(recurringOccurrences.id, day.id));
		expect(waiting).toMatchObject({ status: "pending", transactionId: null });
		const after = await preview(alice, october);
		expect(lineOf(after, "ESSENCE DU COIN").status).toBe("new");
		expect(lineOf(after, "CAFE").status).toBe("matched");
		expect(lineOf(after, "BANQUE EXEMPLE").status).toBe("recurring");
	});
});
