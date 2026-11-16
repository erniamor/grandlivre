import type { StatementPreview, StatementPreviewLine } from "@repo/schemas";
import { WEB_ORIGIN } from "@test/helpers/auth";
import {
	addTestMember,
	createTestHousehold,
	signInUser,
	type TestUser,
} from "@test/helpers/households";
import { householdApi } from "@test/helpers/transactions";
import { describe, expect, it } from "vitest";
import { app } from "@/app";
import { db } from "@/db/client";
import {
	recurringOccurrences,
	recurringTransactions,
	statementAccounts,
	statementLines,
} from "@/db/schema";
import { hashStatementNumber } from "@/routes/imports/statement-number";

/** A line of a Desjardins account statement (see statements/desjardins.ts), made up. */
function accountLine(
	folio: string,
	date: string,
	description: string,
	out: string,
	into: string,
	balance: string,
) {
	return `"Caisse du Plateau","${folio}","EOP","${date}",1,"${description}","",${out ? out : '""'},${into ? into : '""'},"","","","",${balance}`;
}

/** October on the everyday account (folio 123456): 5 000.00 before. */
const october = [
	accountLine(
		"123456",
		"2026/10/01",
		"Achat préautorisé /ESSENCE DU COIN",
		"60.50",
		"",
		"4939.50",
	),
	accountLine(
		"123456",
		"2026/10/02",
		"Retrait au GA /CD PLATEAU",
		"100.00",
		"",
		"4839.50",
	),
	accountLine(
		"123456",
		"2026/10/05",
		"Paiement facture - AccèsD Internet /Remises Visa Desjardins",
		"250.00",
		"",
		"4589.50",
	),
	accountLine(
		"123456",
		"2026/10/15",
		"Virement - AccèsD Internet /à 654321 EOP",
		"300.00",
		"",
		"4289.50",
	),
	accountLine(
		"123456",
		"2026/10/15",
		"Paie /EMPLOYEUR INC.",
		"",
		"2000.00",
		"6289.50",
	),
	accountLine(
		"123456",
		"2026/10/20",
		"Hypothèque /BANQUE EXEMPLE",
		"1500.00",
		"",
		"4789.50",
	),
	accountLine("123456", "2026/10/22", "Achat /CAFE", "4.25", "", "4785.25"),
	accountLine("123456", "2026/10/22", "Achat /CAFE", "4.25", "", "4781.00"),
].join("\r\n");

/** The other side of October's transfer, on the second account (folio 654321). */
const savingsSide = accountLine(
	"654321",
	"2026/10/15",
	"Virement - AccèsD Internet /de 123456 EOP",
	"",
	"300.00",
	"10300.00",
);

const EVERYDAY = "desjardins:caisseduplateau:123456:EOP";
const SAVINGS = "desjardins:caisseduplateau:654321:EOP";

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
	const everyday = await h.account(alice, { name: "Everyday" });
	const savings = await h.account(alice, { name: "Savings", type: "savings" });
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

	/** Sends a file as the browser does: a multipart form. */
	const preview = (
		user: TestUser | undefined,
		file: string | Blob | null,
		targets?: unknown,
	) => {
		const form = new FormData();
		if (file !== null) {
			form.set(
				"file",
				typeof file === "string"
					? new Blob([Buffer.from(file, "latin1")], { type: "text/csv" })
					: file,
				"releve.csv",
			);
		}
		if (targets !== undefined) {
			form.set(
				"targets",
				typeof targets === "string" ? targets : JSON.stringify(targets),
			);
		}
		return app.request(`${h.base}/imports/preview`, {
			method: "POST",
			headers: { Origin: WEB_ORIGIN, ...(user ? { Cookie: user.cookie } : {}) },
			body: form,
		});
	};
	const previewed = async (
		user: TestUser,
		file: string,
		targets?: unknown,
	): Promise<StatementPreview> => {
		const response = await preview(user, file, targets);
		expect(response.status).toBe(200);
		return (await response.json()) as StatementPreview;
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
			numberEnd: number.slice(-3),
		});
	return {
		alice,
		bob,
		carol,
		household,
		h,
		everyday,
		savings,
		card,
		wallet,
		bobs,
		fuel,
		preview,
		previewed,
		knowAs,
	};
}

const byPayee = (lines: StatementPreviewLine[], payee: string) =>
	lines.filter((line) => line.payee === payee);

describe("POST /v1/households/:householdId/imports/preview", () => {
	it("reads a file, whose account is still to choose", async () => {
		const { alice, previewed } = await setUp();

		const { format, accounts } = await previewed(alice, october);

		expect(format).toBe("desjardins_accounts");
		expect(accounts).toHaveLength(1);
		expect(accounts[0]).toMatchObject({
			index: 0,
			bankName: "Caisse du Plateau",
			numberEnd: "456",
			type: "checking",
			openingBalance: 5_000_00,
			closingBalance: 4_781_00,
			from: "2026-10-01",
			to: "2026-10-22",
			accountId: null,
			recognized: false,
			writable: false,
		});
		expect(accounts[0]?.lines).toHaveLength(8);
		expect(accounts[0]?.lines.every((line) => line.status === "new")).toBe(
			true,
		);
	});

	it("recognizes an account an earlier import tied, or goes where it is told", async () => {
		const { alice, everyday, savings, previewed, knowAs } = await setUp();
		await knowAs(EVERYDAY, everyday.id);

		const [recognized] = (await previewed(alice, october)).accounts;
		const [told] = (
			await previewed(alice, october, [{ index: 0, accountId: savings.id }])
		).accounts;

		expect(recognized).toMatchObject({
			accountId: everyday.id,
			recognized: true,
			writable: true,
		});
		expect(told).toMatchObject({
			accountId: savings.id,
			recognized: false,
			writable: true,
		});
	});

	it("finds what is already in the account: imported, recorded by hand, a recurring day", async () => {
		const { alice, household, h, everyday, previewed, knowAs } = await setUp();
		await knowAs(EVERYDAY, everyday.id);
		// Noted the day before the bank posted it
		const fuelling = await h.created(alice, {
			type: "expense",
			accountId: everyday.id,
			date: "2026-09-30",
			payee: "Essence",
			lines: [{ amount: 60_50 }],
		});
		// One coffee noted, two on the statement
		const coffee = await h.created(alice, {
			type: "expense",
			accountId: everyday.id,
			date: "2026-10-22",
			lines: [{ amount: 4_25 }],
		});
		// Imported before: the pay
		const pay = await h.created(alice, {
			type: "income",
			accountId: everyday.id,
			date: "2026-10-15",
			lines: [{ amount: 2_000_00 }],
		});
		const first = await previewed(alice, october);
		const payLine = byPayee(
			first.accounts[0]?.lines ?? [],
			"EMPLOYEUR INC.",
		)[0];
		await db.insert(statementLines).values({
			householdId: household.id,
			accountId: everyday.id,
			externalId: payLine?.externalId ?? "",
			transactionId: pay.id,
		});
		// The mortgage's day, waiting for a member
		const [mortgage] = await db
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
		await db.insert(recurringOccurrences).values({
			recurringId: mortgage?.id ?? "",
			householdId: household.id,
			date: "2026-10-20",
			status: "pending",
		});

		const { lines = [] } = (await previewed(alice, october)).accounts[0] ?? {};

		expect(byPayee(lines, "ESSENCE DU COIN")[0]).toMatchObject({
			status: "matched",
			match: {
				transactionId: fuelling.id,
				type: "expense",
				date: "2026-09-30",
				payee: "Essence",
			},
		});
		expect(byPayee(lines, "EMPLOYEUR INC.")[0]).toMatchObject({
			status: "imported",
			match: { transactionId: pay.id },
		});
		expect(byPayee(lines, "BANQUE EXEMPLE")[0]).toMatchObject({
			status: "recurring",
			occurrence: {
				recurringId: mortgage?.id,
				date: "2026-10-20",
				payee: "Mortgage",
			},
		});
		expect(byPayee(lines, "CAFE").map((line) => line.status)).toEqual([
			"matched",
			"new",
		]);
		expect(byPayee(lines, "CAFE")[0]?.match?.transactionId).toBe(coffee.id);
	});

	it("suggests transfers the descriptions name, and tags the payees had", async () => {
		const {
			alice,
			h,
			everyday,
			savings,
			card,
			wallet,
			fuel,
			previewed,
			knowAs,
		} = await setUp();
		await knowAs(EVERYDAY, everyday.id);
		await knowAs(SAVINGS, savings.id);
		await knowAs("desjardins-card:remisesvisa:1234", card.id, "Remises Visa");
		await h.created(alice, {
			type: "expense",
			accountId: card.id,
			date: "2026-06-01",
			payee: "Essence du coin",
			lines: [{ amount: 50_00, tagId: fuel.id }],
		});

		const { lines = [] } = (await previewed(alice, october)).accounts[0] ?? {};

		const suggestion = (payee: string) => byPayee(lines, payee)[0]?.suggestion;
		expect(suggestion("ESSENCE DU COIN")).toEqual({
			kind: "tag",
			tagId: fuel.id,
		});
		expect(suggestion("CD PLATEAU")).toEqual({
			kind: "transfer",
			accountId: wallet.id,
		});
		expect(suggestion("Remises Visa Desjardins")).toEqual({
			kind: "transfer",
			accountId: card.id,
		});
		expect(suggestion("à 654321 EOP")).toEqual({
			kind: "transfer",
			accountId: savings.id,
		});
		expect(suggestion("BANQUE EXEMPLE")).toBeNull();
	});

	it("pairs a transfer between two accounts of the same file", async () => {
		const { alice, everyday, savings, previewed } = await setUp();

		const { accounts } = await previewed(
			alice,
			`${october}\r\n${savingsSide}`,
			[
				{ index: 0, accountId: everyday.id },
				{ index: 1, accountId: savings.id },
			],
		);

		const [out] = byPayee(accounts[0]?.lines ?? [], "à 654321 EOP");
		const [into] = accounts[1]?.lines ?? [];
		expect(out).toMatchObject({
			pair: { index: 1, externalId: into?.externalId },
			suggestion: { kind: "transfer", accountId: savings.id },
		});
		expect(into).toMatchObject({
			pair: { index: 0, externalId: out?.externalId },
			suggestion: { kind: "transfer", accountId: everyday.id },
		});
	});

	it("compares nothing in an account the member doesn't hold, nor learns from what they can't see", async () => {
		const { alice, bob, h, everyday, fuel, previewed, knowAs } = await setUp();
		await knowAs(EVERYDAY, everyday.id);
		await h.updateAccount(alice, everyday.id, { visibility: "balance" });
		await h.created(alice, {
			type: "expense",
			accountId: everyday.id,
			date: "2026-10-01",
			payee: "Essence du coin",
			lines: [{ amount: 60_50, tagId: fuel.id }],
		});

		const [account] = (await previewed(bob, october)).accounts;

		expect(account).toMatchObject({ accountId: everyday.id, writable: false });
		expect(account?.lines.every((line) => line.status === "new")).toBe(true);
		expect(account?.lines.every((line) => line.suggestion === null)).toBe(true);
	});

	it("sends lines only into an open account the member holds", async () => {
		const { alice, h, savings, bobs, preview } = await setUp();
		await h.updateAccount(alice, savings.id, { archived: true });

		for (const targets of [
			[{ index: 0, accountId: bobs.id }],
			[{ index: 0, accountId: savings.id }],
			[{ index: 0, accountId: "00000000-0000-4000-8000-000000000001" }],
			[{ index: 1, accountId: bobs.id }],
		]) {
			const response = await preview(alice, october, targets);
			expect(response.status).toBe(422);
			expect(await response.json()).toMatchObject({
				error: { details: [{ field: "targets" }] },
			});
		}
		expect((await preview(alice, october, "not json")).status).toBe(422);
	});

	it("says what can't be read, and which line", async () => {
		const { alice, preview } = await setUp();
		const broken = october.replace("60.50", "60,50");

		const unreadable = await preview(alice, broken);
		const missing = await preview(alice, null);
		const tooLarge = await preview(
			alice,
			new Blob([new Uint8Array(1024 * 1024 + 1)]),
		);

		expect(unreadable.status).toBe(422);
		expect(await unreadable.json()).toMatchObject({
			error: {
				details: [{ field: "file", message: "statement_unreadable", line: 1 }],
			},
		});
		expect(missing.status).toBe(422);
		expect(tooLarge.status).toBe(422);
	});

	it("hides the household from outsiders and requires a session", async () => {
		const { carol, preview } = await setUp();

		expect((await preview(carol, october)).status).toBe(404);
		expect((await preview(undefined, october)).status).toBe(401);
	});
});
