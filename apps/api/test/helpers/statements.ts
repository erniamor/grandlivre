import { WEB_ORIGIN } from "@test/helpers/auth";
import type { TestUser } from "@test/helpers/households";
import { app } from "@/app";

/** A line of a Desjardins account statement (see statements/desjardins.ts), made up. */
export function accountLine(
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
export const october = [
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
export const savingsSide = accountLine(
	"654321",
	"2026/10/15",
	"Virement - AccèsD Internet /de 123456 EOP",
	"",
	"300.00",
	"10300.00",
);

export const EVERYDAY = "desjardins:caisseduplateau:123456:EOP";
export const SAVINGS = "desjardins:caisseduplateau:654321:EOP";

/**
 * Posts a statement as the browser does, a multipart form: `file` (a
 * statement's text, sent in Windows-1252 as Desjardins does, or a Blob),
 * and the other fields as JSON.
 */
export function postStatement(
	path: string,
	user: TestUser | undefined,
	file: string | Blob | null,
	fields: Record<string, unknown> = {},
) {
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
	for (const [name, value] of Object.entries(fields)) {
		if (value !== undefined) {
			form.set(name, typeof value === "string" ? value : JSON.stringify(value));
		}
	}
	return app.request(path, {
		method: "POST",
		headers: { Origin: WEB_ORIGIN, ...(user ? { Cookie: user.cookie } : {}) },
		body: form,
	});
}

/** A line of a Desjardins cards export, made up: a purchase, or a payment or credit. */
export function cardLine(
	card: string,
	date: string,
	description: string,
	purchase: string,
	credit: string,
) {
	return `${card},"","",${date},1,${description.padEnd(41)},"","","","","",${purchase || '""'},${credit || '""'}`;
}
