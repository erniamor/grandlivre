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
import {
	accountLine,
	cardLine,
	EVERYDAY,
	october,
	postStatement,
	SAVINGS,
	savingsSide,
} from "@test/helpers/statements";
import { householdApi } from "@test/helpers/transactions";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import {
	recurringOccurrences,
	recurringTransactionLines,
	recurringTransactions,
	statementAccounts,
} from "@/db/schema";
import { hashStatementNumber } from "@/routes/imports/statement-number";

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
	/** What an earlier import would have kept: a statement account tied to an account. */
	const knowAs = (
		number: string,
		accountId: string,
		bankName = "Caisse du Plateau",
	) =>
		db.insert(statementAccounts).values({
			householdId: household.id,
			accountId,
			numberHash: hashStatementNumber(number),
			bankName,
			numberEnd: number.slice(-4),
		});
	return {
		alice,
		bob,
		carol,
		h,
		knowAs,
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

describe("an account imported after the other side of its transfers", () => {
	it("finds a transfer's other side entered in another account, and makes it the transfer", async () => {
		const {
			alice,
			h,
			everyday,
			savings,
			home,
			knowAs,
			preview,
			importIt,
			balanceOf,
		} = await setUp();
		await knowAs(EVERYDAY, everyday.id);
		await knowAs(SAVINGS, savings.id);
		// The savings account, imported alone before: the transfer as an income
		const income = await h.created(alice, {
			type: "income",
			accountId: savings.id,
			date: "2026-10-15",
			payee: "de 123456 EOP",
			note: "Kept",
			lines: [{ amount: 300_00, tagId: home.id }],
		});
		const before = await preview(alice, october);
		const line = lineOf(before, "à 654321 EOP");

		expect(line).toMatchObject({
			status: "counterpart",
			match: {
				transactionId: income.id,
				type: "income",
				accountId: savings.id,
			},
			suggestion: { kind: "transfer", accountId: savings.id },
		});
		const response = await importIt(alice, october, {
			accounts: [
				{
					index: 0,
					target: { accountId: everyday.id },
					lines: [
						{
							externalId: line.externalId,
							action: "join",
							transactionId: income.id,
						},
					],
				},
			],
		});

		expect(response.status).toBe(201);
		expect(await json<StatementImport>(response)).toMatchObject({
			accounts: [{ accountId: everyday.id, joined: 1, created: 0 }],
		});
		expect(
			await json<Transaction>(await h.get(alice, income.id)),
		).toMatchObject({
			type: "transfer",
			accountId: everyday.id,
			toAccountId: savings.id,
			amount: 300_00,
			note: "Kept",
			lines: [],
		});
		// Counted once: out of the everyday account, into the savings as before
		expect(await balanceOf(everyday.id)).toBe(5_000_00 - 300_00);
		expect(await balanceOf(savings.id)).toBe(10_000_00 + 300_00);
		expect(lineOf(await preview(alice, october), "à 654321 EOP").status).toBe(
			"imported",
		);
	});

	it("finds a card's payment entered as an expense of an account, and undoes the transfer as it was", async () => {
		const { alice, h, everyday, card, home, preview, importIt, balanceOf } =
			await setUp();
		const paid = await h.created(alice, {
			type: "expense",
			accountId: everyday.id,
			date: "2026-10-05",
			payee: "Remises Visa Desjardins",
			lines: [{ amount: 250_00, tagId: home.id }],
		});
		const statement = [
			cardLine(
				"Remises Visa **** 1234",
				"2026/10/02",
				"CAFE EXEMPLE",
				"4.25",
				"",
			),
			cardLine(
				"Remises Visa **** 1234",
				"2026/10/06",
				"PAIEMENT CAISSE",
				"",
				"250.00",
			),
		].join("\n");
		const before = await preview(alice, statement, [
			{ index: 0, accountId: card.id },
		]);
		const payment = lineOf(before, "PAIEMENT CAISSE");

		expect(payment).toMatchObject({
			status: "counterpart",
			match: { transactionId: paid.id, accountId: everyday.id },
		});
		expect(lineOf(before, "CAFE EXEMPLE").status).toBe("new");
		const made = await json<StatementImport>(
			await importIt(alice, statement, {
				accounts: [
					{
						index: 0,
						target: { accountId: card.id },
						lines: [
							{
								externalId: payment.externalId,
								action: "join",
								transactionId: paid.id,
							},
						],
					},
				],
			}),
		);
		expect(await balanceOf(card.id)).toBe(250_00);
		expect(await balanceOf(everyday.id)).toBe(5_000_00 - 250_00);

		await api(`${h.base}/imports/${made.id}`, {
			method: "DELETE",
			cookie: alice.cookie,
		});

		expect(await json<Transaction>(await h.get(alice, paid.id))).toMatchObject({
			type: "expense",
			accountId: everyday.id,
			toAccountId: null,
			payee: "Remises Visa Desjardins",
			lines: [expect.objectContaining({ amount: 250_00, tagId: home.id })],
		});
		expect(await balanceOf(card.id)).toBe(0);
	});

	it("refuses to join what isn't the other side", async () => {
		const { alice, h, everyday, savings, bobs, preview, importIt } =
			await setUp();
		const line = lineOf(
			await preview(alice, october, [{ index: 0, accountId: everyday.id }]),
			"à 654321 EOP",
		);
		const cases = [
			// Another amount
			await h.created(alice, {
				type: "income",
				accountId: savings.id,
				date: "2026-10-15",
				lines: [{ amount: 299_00 }],
			}),
			// The same way: money out of both
			await h.created(alice, {
				type: "expense",
				accountId: savings.id,
				date: "2026-10-15",
				lines: [{ amount: 300_00 }],
			}),
			// On the line's own account
			await h.created(alice, {
				type: "income",
				accountId: everyday.id,
				date: "2026-10-15",
				lines: [{ amount: 300_00 }],
			}),
		];
		const bob = await signInUser("bob@example.com");
		cases.push(
			await h.created(bob, {
				type: "income",
				accountId: bobs.id,
				date: "2026-10-15",
				lines: [{ amount: 300_00 }],
			}),
		);

		for (const transaction of cases) {
			const response = await importIt(alice, october, {
				accounts: [
					{
						index: 0,
						target: { accountId: everyday.id },
						lines: [
							{
								externalId: line.externalId,
								action: "join",
								transactionId: transaction.id,
							},
						],
					},
				],
			});
			expect(response.status).toBe(422);
		}
	});
});

describe("the opening balance of an account the statements go further back in", () => {
	/**
	 * September, before October's statement: 4 900.00 at its start, 5 000.00
	 * at its end, as October starts.
	 */
	const september = [
		accountLine(
			"123456",
			"2026/09/10",
			"Achat /LIBRAIRIE",
			"50.00",
			"",
			"4850.00",
		),
		accountLine(
			"123456",
			"2026/09/25",
			"Paie /EMPLOYEUR INC.",
			"",
			"150.00",
			"5000.00",
		),
	].join("\r\n");

	it("starts the account at the statement's opening balance, and back on undo", async () => {
		const { alice, h, everyday, preview, importIt, balanceOf } = await setUp();
		// The account made with October's opening balance, then October imported
		await h.updateAccount(alice, everyday.id, { openingBalance: 5_000_00 });
		const october_ = await preview(alice, october, [
			{ index: 0, accountId: everyday.id },
		]);
		await importIt(alice, october, {
			accounts: [
				{
					index: 0,
					target: { accountId: everyday.id },
					lines: october_.accounts[0]?.lines.map((line) => ({
						externalId: line.externalId,
						action: "create",
					})),
				},
			],
		});
		const octoberEnd = await balanceOf(everyday.id);
		const lines = (await preview(alice, september)).accounts[0]?.lines ?? [];

		const made = await json<StatementImport>(
			await importIt(alice, september, {
				accounts: [
					{
						index: 0,
						target: { accountId: everyday.id },
						lines: lines.map((line) => ({
							externalId: line.externalId,
							action: "create",
						})),
					},
				],
			}),
		);

		expect(made.accounts).toEqual([
			expect.objectContaining({
				accountId: everyday.id,
				created: 2,
				openingBalance: 4_900_00,
			}),
		]);
		// September's lines and its opening balance: October's end is the bank's still
		expect(await balanceOf(everyday.id)).toBe(octoberEnd);
		expect((await h.getAccount(alice, everyday.id)).openingBalance).toBe(
			4_900_00,
		);

		await api(`${h.base}/imports/${made.id}`, {
			method: "DELETE",
			cookie: alice.cookie,
		});
		expect((await h.getAccount(alice, everyday.id)).openingBalance).toBe(
			5_000_00,
		);
	});

	it("moves the opening balance to the statement's when the file goes further back", async () => {
		const { alice, h, everyday, preview, importIt } = await setUp();
		// Opened at 5 000.00 before October; a September file with other balances
		const earlier = [
			accountLine(
				"123456",
				"2026/09/10",
				"Achat /LIBRAIRIE",
				"50.00",
				"",
				"4000.00",
			),
		].join("\r\n");
		const lines =
			(await preview(alice, earlier, [{ index: 0, accountId: everyday.id }]))
				.accounts[0]?.lines ?? [];
		const plan = {
			accounts: [
				{
					index: 0,
					target: { accountId: everyday.id },
					lines: lines.map((line) => ({
						externalId: line.externalId,
						action: "create",
					})),
				},
			],
		};

		const made = await json<StatementImport>(
			await importIt(alice, earlier, plan),
		);

		expect(made.accounts[0]?.openingBalance).toBe(4_050_00);
		expect((await h.getAccount(alice, everyday.id)).openingBalance).toBe(
			4_050_00,
		);
		await api(`${h.base}/imports/${made.id}`, {
			method: "DELETE",
			cookie: alice.cookie,
		});
		expect((await h.getAccount(alice, everyday.id)).openingBalance).toBe(
			5_000_00,
		);
	});

	it("leaves the opening balance when the account has older transactions", async () => {
		const { alice, h, everyday, preview, importIt } = await setUp();
		await h.created(alice, {
			type: "expense",
			accountId: everyday.id,
			date: "2026-08-01",
			lines: [{ amount: 10_00 }],
		});
		const lines =
			(await preview(alice, september, [{ index: 0, accountId: everyday.id }]))
				.accounts[0]?.lines ?? [];

		const made = await json<StatementImport>(
			await importIt(alice, september, {
				accounts: [
					{
						index: 0,
						target: { accountId: everyday.id },
						lines: lines.map((line) => ({
							externalId: line.externalId,
							action: "create",
						})),
					},
				],
			}),
		);

		expect(made.accounts[0]?.openingBalance).toBeNull();
		expect((await h.getAccount(alice, everyday.id)).openingBalance).toBe(
			5_000_00,
		);
	});
});
