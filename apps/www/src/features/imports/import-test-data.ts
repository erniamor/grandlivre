import type {
	StatementPreview,
	StatementPreviewAccount,
	StatementPreviewLine,
} from "@repo/schemas";

/** The everyday account, already known: a line to tag, cash taken out, a transfer out, a line imported. */
export const everydayAccount: StatementPreviewAccount = {
	index: 0,
	bankName: "Caisse du Plateau",
	numberEnd: "456",
	type: "checking",
	openingBalance: 5_000_00,
	closingBalance: 4_539_50,
	from: "2026-10-01",
	to: "2026-10-15",
	accountId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
	recognized: true,
	writable: true,
	lines: [
		{
			externalId: "fuel-0",
			date: "2026-10-01",
			amount: -60_50,
			description: "Achat préautorisé /ESSENCE DU COIN",
			payee: "ESSENCE DU COIN",
			status: "new",
			match: null,
			occurrence: null,
			suggestion: {
				kind: "tag",
				tagId: "4d5e6f7a-8b9c-4d0e-9f2a-3b4c5d6e7f8a",
			},
			pair: null,
		},
		{
			externalId: "atm-0",
			date: "2026-10-02",
			amount: -100_00,
			description: "Retrait au GA /CD PLATEAU",
			payee: "CD PLATEAU",
			status: "new",
			match: null,
			occurrence: null,
			suggestion: {
				kind: "transfer",
				accountId: "3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f",
			},
			pair: null,
		},
		{
			externalId: "out-0",
			date: "2026-10-15",
			amount: -300_00,
			description: "Virement - AccèsD Internet /à 654321 EOP",
			payee: "à 654321 EOP",
			status: "new",
			match: null,
			occurrence: null,
			suggestion: null,
			pair: { index: 1, externalId: "in-0" },
		},
		{
			externalId: "pay-0",
			date: "2026-10-15",
			amount: 2_000_00,
			description: "Paie /EMPLOYEUR INC.",
			payee: "EMPLOYEUR INC.",
			status: "imported",
			match: {
				transactionId: "5e6f7a8b-9c0d-4e1f-8a3b-4c5d6e7f8a9b",
				type: "income",
				date: "2026-10-15",
				payee: "Employer",
				accountId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
			},
			occurrence: null,
			suggestion: null,
			pair: null,
		},
	],
};

/** The savings account, new: its one line is the other side of the transfer. */
export const savingsAccount: StatementPreviewAccount = {
	index: 1,
	bankName: "Caisse du Plateau",
	numberEnd: "321",
	type: "savings",
	openingBalance: 10_000_00,
	closingBalance: 10_300_00,
	from: "2026-10-15",
	to: "2026-10-15",
	accountId: null,
	recognized: false,
	writable: false,
	lines: [
		{
			externalId: "in-0",
			date: "2026-10-15",
			amount: 300_00,
			description: "Virement - AccèsD Internet /de 123456 EOP",
			payee: "de 123456 EOP",
			status: "new",
			match: null,
			occurrence: null,
			suggestion: null,
			pair: { index: 0, externalId: "out-0" },
		},
	],
};

/** The line into the savings account. */
export const transferIn = savingsAccount.lines[0] as StatementPreviewLine;

/**
 * A made-up preview, for the tests: an everyday account already known,
 * with a line to tag, cash taken out and a transfer to a savings account,
 * itself new, whose line is the other side of that transfer.
 */
export const statementPreview: StatementPreview = {
	format: "desjardins_accounts",
	accounts: [everydayAccount, savingsAccount],
};
