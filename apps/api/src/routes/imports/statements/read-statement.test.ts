import { describe, expect, it } from "vitest";
import {
	readStatement,
	STATEMENT_MAX_LINES,
} from "@/routes/imports/statements/read-statement";
import type { Statement } from "@/routes/imports/statements/statement";

/*
 * Made-up files, in the shapes Desjardins exports (see desjardins.ts): a
 * statement of an account (Windows-1252, quoted, a blank first line, 14
 * columns), the history of accounts (UTF-8 without accents, 16 columns,
 * each day's lines last first) and the history of cards.
 */

const statementOfOctober = [
	"",
	'"Caisse du Plateau-Mont-Royal","123456","EOP","2026/10/01",1,"Hypothèque /BANQUE EXEMPLE (PAY)","",1500.00,"","","","","",3500.00',
	'"Caisse du Plateau-Mont-Royal","123456","EOP","2026/10/01",2,"Achat préautorisé /ESSENCE DU COIN","",60.50,"","","","","",3439.50',
	'"Caisse du Plateau-Mont-Royal","123456","EOP","2026/10/15",3,"Paie /EMPLOYEUR INC.","","",2000.00,"","","","",5439.50',
	'"Caisse du Plateau-Mont-Royal","123456","EOP","2026/10/15",4,"Virement - AccèsD Internet /à 654321 EOP","",300.00,"","","","","",5139.50',
].join("\r\n");

/** The same month in the history: no accents, the folio's zero, a day's lines last first. */
const historyOfAccounts = [
	'Caisse du Plateau-Mont-Royal,0123456,EOP,2026/09/30,1,Depot direct /GOUV. EXEMPLE,"","",100.00,"","","","","",5000.00,""',
	'Caisse du Plateau-Mont-Royal,0123456,EOP,2026/10/01,2,Achat preautorise /ESSENCE DU COIN,"",60.50,"","","","","","",3439.50,""',
	'Caisse du Plateau-Mont-Royal,0123456,EOP,2026/10/01,3,Hypotheque /BANQUE EXEMPLE (PAY),"",1500.00,"","","","","","",3500.00,""',
	'Caisse du Plateau-Mont-Royal,0123456,EOP,2026/10/15,4,Virement - AccesD Internet /a 0654321-EOP,"",300.00,"","","","","","",5139.50,""',
	'Caisse du Plateau-Mont-Royal,0123456,EOP,2026/10/15,5,Paie /EMPLOYEUR INC.,"","",2000.00,"","","","","",5439.50,""',
	'Caisse du Plateau-Mont-Royal,0654321,ES,2026/10/15,1,Virement - AccesD Internet /de 0123456-EOP,"","",300.00,"","","","","",10300.00,""',
].join("\n");

const card = (merchant: string, city: string, province: string) =>
	`${merchant.padEnd(25)}${city.padEnd(13)}${province.padEnd(2)} `;

const historyOfCards = [
	`Remises Visa **** 1234,"","",2026/10/02,1,${card("EPICERIE DU QUARTIER #12", "MONTREAL", "QC")},"","","","","",45.10,""`,
	`Remises Visa **** 1234,"","",2026/10/02,2,${card("CAFE EXEMPLE", "MONTREAL", "QC")},"","","","","",4.25,""`,
	`Remises Visa **** 1234,"","",2026/10/02,3,${card("CAFE EXEMPLE", "MONTREAL", "QC")},"","","","","",4.25,""`,
	`Remises Visa **** 1234,"","",2026/10/10,4,${"PAIEMENT CAISSE".padEnd(41)},"","","","","","",49.35`,
	`Boni Visa **** 9876,"","",2026/10/05,1,${card("LIBRAIRIE EXEMPLE", "QUEBEC", "QC")},"","","","","",20.00,""`,
	// Listed apart in the export, after the card's other lines
	`Remises Visa **** 1234,"","",2026/10/01,1,${"CREDIT REMISES".padEnd(41)},"","","","","","",3.00`,
].join("\n");

/** A file's bytes: Windows-1252 for a statement, UTF-8 otherwise. */
const windows1252 = (text: string) => Buffer.from(text, "latin1");
const utf8 = (text: string) => Buffer.from(text, "utf-8");

function read(bytes: Uint8Array): Statement {
	const result = readStatement(bytes);
	if (!result.ok) {
		throw new Error(`Not read: ${result.error}`);
	}
	return result.statement;
}

describe("readStatement: Desjardins accounts", () => {
	it("reads an account's statement, its lines, payees and balances", () => {
		const { format, accounts } = read(windows1252(statementOfOctober));

		expect(format).toBe("desjardins_accounts");
		expect(accounts).toHaveLength(1);
		const [account] = accounts;
		expect(account).toMatchObject({
			bankName: "Caisse du Plateau-Mont-Royal",
			numberEnd: "456",
			type: "checking",
			openingBalance: 5_000_00,
			closingBalance: 5_139_50,
		});
		expect(account?.lines.map(({ externalId, ...line }) => line)).toEqual([
			{
				date: "2026-10-01",
				amount: -1_500_00,
				description: "Hypothèque /BANQUE EXEMPLE (PAY)",
				payee: "BANQUE EXEMPLE (PAY)",
			},
			{
				date: "2026-10-01",
				amount: -60_50,
				description: "Achat préautorisé /ESSENCE DU COIN",
				payee: "ESSENCE DU COIN",
			},
			{
				date: "2026-10-15",
				amount: 2_000_00,
				description: "Paie /EMPLOYEUR INC.",
				payee: "EMPLOYEUR INC.",
			},
			{
				date: "2026-10-15",
				amount: -300_00,
				description: "Virement - AccèsD Internet /à 654321 EOP",
				payee: "à 654321 EOP",
			},
		]);
	});

	it("reads the history: several accounts, each day's lines put back in order", () => {
		const { accounts } = read(utf8(historyOfAccounts));

		const [everyday, savings] = accounts;
		expect(everyday?.lines.map((line) => line.amount)).toEqual([
			100_00, -1_500_00, -60_50, 2_000_00, -300_00,
		]);
		expect(everyday).toMatchObject({
			openingBalance: 4_900_00,
			closingBalance: 5_139_50,
		});
		expect(savings).toMatchObject({
			numberEnd: "321",
			type: "savings",
			openingBalance: 10_000_00,
			closingBalance: 10_300_00,
		});
	});

	it("gives a line the same identity in the statement and in the history", () => {
		const [statement] = read(windows1252(statementOfOctober)).accounts;
		const [history] = read(utf8(historyOfAccounts)).accounts;

		expect(statement?.number).toBe(history?.number);
		const inHistory = new Set(history?.lines.map((line) => line.externalId));
		expect(
			statement?.lines.every((line) => inHistory.has(line.externalId)),
		).toBe(true);
	});

	it("leaves the balances unknown when they don't follow, in either order", () => {
		const [account] = read(
			utf8(historyOfAccounts.replace("5139.50", "5100.00")),
		).accounts;

		expect(account).toMatchObject({
			openingBalance: null,
			closingBalance: null,
		});
		expect(account?.lines).toHaveLength(5);
	});
});

describe("readStatement: Desjardins cards", () => {
	it("reads each card: purchases out, payments and credits in, the merchant as payee", () => {
		const { format, accounts } = read(utf8(historyOfCards));

		expect(format).toBe("desjardins_cards");
		const [remises, boni] = accounts;
		expect(remises).toMatchObject({
			bankName: "Remises Visa",
			numberEnd: "1234",
			type: "credit_card",
			openingBalance: null,
			closingBalance: null,
		});
		expect(
			remises?.lines.map(({ date, amount, payee }) => [date, amount, payee]),
		).toEqual([
			["2026-10-01", 3_00, "CREDIT REMISES"],
			["2026-10-02", -45_10, "EPICERIE DU QUARTIER #12"],
			["2026-10-02", -4_25, "CAFE EXEMPLE"],
			["2026-10-02", -4_25, "CAFE EXEMPLE"],
			["2026-10-10", 49_35, "PAIEMENT CAISSE"],
		]);
		expect(boni).toMatchObject({ bankName: "Boni Visa", numberEnd: "9876" });
	});

	it("tells two lines alike on the same day apart", () => {
		const [remises] = read(utf8(historyOfCards)).accounts;
		const coffees = remises?.lines.filter(
			(line) => line.payee === "CAFE EXEMPLE",
		);

		expect(coffees?.[0]?.externalId).not.toBe(coffees?.[1]?.externalId);
		expect(coffees?.[0]?.externalId).toMatch(/-0$/);
		expect(coffees?.[1]?.externalId).toMatch(/-1$/);
	});
});

describe("readStatement: what can't be read", () => {
	it("says a file is empty, or too long", () => {
		expect(readStatement(utf8("\r\n\r\n"))).toEqual({
			ok: false,
			error: "statement_empty",
		});
		const line = historyOfAccounts.split("\n")[1];
		expect(
			readStatement(
				utf8(
					Array(STATEMENT_MAX_LINES + 1)
						.fill(line)
						.join("\n"),
				),
			),
		).toEqual({ ok: false, error: "statement_too_long" });
	});

	it("names the first line it can't read", () => {
		expect(readStatement(utf8("Date,Description,Amount\n"))).toEqual({
			ok: false,
			error: "statement_unreadable",
			line: 1,
		});
		const broken = historyOfAccounts.replace("60.50", "60,50");
		expect(readStatement(utf8(broken))).toMatchObject({
			error: "statement_unreadable",
			line: 2,
		});
	});
});
