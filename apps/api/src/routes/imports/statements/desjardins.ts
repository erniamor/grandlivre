import type { AccountType } from "@repo/schemas";
import {
	parseBankAmount,
	parseBankDate,
} from "@/routes/imports/statements/amounts";
import {
	descriptionKey,
	withExternalIds,
} from "@/routes/imports/statements/fingerprint";
import type {
	StatementAccount,
	StatementLine,
} from "@/routes/imports/statements/statement";

/*
 * Desjardins (AccèsD) exports CSV files without a header, one line per
 * transaction, several accounts or cards in one file:
 *
 * - accounts: branch, folio, account kind (EOP...), YYYY/MM/DD, a line
 *   number (of the export: not an identity), description, cheque, money
 *   out, money in, then empty columns and the balance after the line. A
 *   statement has 14 columns, the history 16; the history lists a day's
 *   lines last first.
 * - cards: card ("Remises Visa **** 1234"), two empty columns, YYYY/MM/DD,
 *   a line number, description (merchant on 25 characters, city on 13,
 *   province on 2), empty columns, then purchase (11) and credit (12). No
 *   balance.
 */

/** A line read, before its identity is derived. */
type Read = Omit<StatementLine, "externalId">;

/** What an account's line of the file holds. */
interface AccountRow {
	number: string;
	bankName: string;
	folio: string;
	kind: string;
	line: Read;
	/** The balance after the line. */
	balance: number;
}

const ACCOUNT_KINDS: Record<string, AccountType> = {
	// "Épargne avec opérations": the everyday account
	EOP: "checking",
	// "Épargne stable"
	ES: "savings",
};

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

/** The part of an account's description after its kind: "Achat /COSTCO" is COSTCO. */
function accountPayee(description: string): string {
	const slash = description.indexOf("/");
	const after =
		slash < 0
			? ""
			: collapse(description.slice(slash + 1).replace(/\/\s*$/, ""));
	return after || description;
}

/** One line of an accounts export, or null when it isn't one. */
export function readAccountRow(fields: string[]): AccountRow | null {
	if (fields.length < 14) {
		return null;
	}
	const [branch = "", folio = "", kind = "", day = "", , text = ""] = fields;
	const date = parseBankDate(day);
	const out = fields[7]?.trim() ? parseBankAmount(fields[7]) : 0;
	const into = fields[8]?.trim() ? parseBankAmount(fields[8]) : 0;
	// The balance: the last column filled after the amounts
	const last = fields
		.slice(9)
		.map((field) => field.trim())
		.filter(Boolean)
		.at(-1);
	const balance =
		last === undefined ? null : parseBankAmount(last.replace(/^-/, ""));
	if (
		!date ||
		!/^\d+$/.test(folio.trim()) ||
		!/^[A-Z]{2,4}$/.test(kind.trim()) ||
		out === null ||
		into === null ||
		// One way or the other, never both nor neither
		(out === 0) === (into === 0) ||
		balance === null
	) {
		return null;
	}
	const description = collapse(text);
	// The folio is written with or without its leading zeros
	const number = String(Number(folio));
	return {
		number: `desjardins:${descriptionKey(branch)}:${number}:${kind.trim()}`,
		bankName: collapse(branch),
		folio: number,
		kind: kind.trim(),
		line: {
			date,
			amount: into - out,
			description,
			payee: accountPayee(description),
		},
		balance: last?.startsWith("-") ? -balance : balance,
	};
}

/** Each balance follows from the one before and the line's amount. */
function balancesFollow(rows: AccountRow[]): boolean {
	return rows.every(
		(row, at) =>
			at === 0 ||
			row.balance === (rows[at - 1]?.balance ?? 0) + row.line.amount,
	);
}

/** The same lines, each day's in the opposite order. */
function eachDayReversed(rows: AccountRow[]): AccountRow[] {
	const days: AccountRow[][] = [];
	for (const row of rows) {
		const day = days.at(-1);
		if (day && day[0]?.line.date === row.line.date) {
			day.push(row);
		} else {
			days.push([row]);
		}
	}
	return days.flatMap((day) => day.reverse());
}

/**
 * The accounts of a Desjardins accounts export, from its rows already
 * read. The order of a day's lines is the one where each balance follows
 * from the one before: as written (statements) or reversed (history). The
 * opening and closing balances come from it, or stay unknown.
 */
export function desjardinsAccounts(rows: AccountRow[]): StatementAccount[] {
	const byNumber = new Map<string, AccountRow[]>();
	for (const row of rows) {
		byNumber.set(row.number, [...(byNumber.get(row.number) ?? []), row]);
	}
	return [...byNumber.values()].map((written) => {
		const ordered = [written, eachDayReversed(written)].find(balancesFollow);
		const lines = ordered ?? written;
		const [first] = lines;
		const last = lines.at(-1);
		// biome-ignore lint/style/noNonNullAssertion: an account is only made of its rows, at least one
		const { number, bankName, folio, kind } = first!;
		return {
			number,
			bankName,
			numberEnd: folio.slice(-3),
			type: ACCOUNT_KINDS[kind] ?? "other",
			lines: withExternalIds(byDate(lines.map((row) => row.line))),
			openingBalance:
				ordered && first ? first.balance - first.line.amount : null,
			closingBalance: ordered && last ? last.balance : null,
		};
	});
}

/** What a card's line of the file holds. */
interface CardRow {
	number: string;
	bankName: string;
	numberEnd: string;
	line: Read;
}

/** One line of a cards export, or null when it isn't one. */
export function readCardRow(fields: string[]): CardRow | null {
	if (fields.length < 13) {
		return null;
	}
	const card = /^(.*?)\s*\*{4}\s*(\d{4})\s*$/.exec(fields[0] ?? "");
	const date = parseBankDate(fields[3] ?? "");
	const purchase = fields[11]?.trim() ? parseBankAmount(fields[11]) : 0;
	const credit = fields[12]?.trim() ? parseBankAmount(fields[12]) : 0;
	if (
		!card ||
		!date ||
		purchase === null ||
		credit === null ||
		(purchase === 0) === (credit === 0)
	) {
		return null;
	}
	const [, name = "", end = ""] = card;
	const text = fields[5] ?? "";
	const description = collapse(text);
	// The merchant: the first 25 characters, before the city and province
	const payee = text.length >= 41 ? collapse(text.slice(0, 25)) : description;
	return {
		number: `desjardins-card:${descriptionKey(name)}:${end}`,
		bankName: collapse(name),
		numberEnd: end,
		line: {
			date,
			amount: credit - purchase,
			description,
			payee: payee || description,
		},
	};
}

/** The cards of a Desjardins cards export, from its rows already read. */
export function desjardinsCards(rows: CardRow[]): StatementAccount[] {
	const byNumber = new Map<string, CardRow[]>();
	for (const row of rows) {
		byNumber.set(row.number, [...(byNumber.get(row.number) ?? []), row]);
	}
	return [...byNumber.values()].map((cardRows) => {
		// biome-ignore lint/style/noNonNullAssertion: a card is only made of its rows, at least one
		const { number, bankName, numberEnd } = cardRows[0]!;
		return {
			number,
			bankName,
			numberEnd,
			type: "credit_card",
			lines: withExternalIds(byDate(cardRows.map((row) => row.line))),
			// A card export gives no balance
			openingBalance: null,
			closingBalance: null,
		};
	});
}

/** Oldest first, lines of the same day kept in their order. */
function byDate(lines: Read[]): Read[] {
	return [...lines].sort((a, b) => a.date.localeCompare(b.date));
}

/** What a line's description says of the other side of a transfer. */
export type TransferHint =
	/** Another account at the same branch, by its number in the statements. */
	| { kind: "account"; number: string }
	/** A bill paid: a card, if the bank's name for one of the cards is in it. */
	| { kind: "card"; name: string }
	/** Cash taken out at a teller machine: the member's wallet. */
	| { kind: "cash" };

/**
 * What a Desjardins account line's description says of a transfer it may
 * be: "Virement - AccèsD Internet /à 123456 EOP" (to or from another
 * account of the branch), "Paiement facture - AccèsD Internet /Remises Visa
 * Desjardins" (a bill, maybe a card), "Retrait au GA" (cash). Null for
 * anything else, and for card lines.
 */
export function desjardinsTransferHint(
	accountNumber: string,
	description: string,
): TransferHint | null {
	const plain = description.normalize("NFKD").replace(/[̀-ͯ]/g, "");
	const branch = /^desjardins:([^:]*):/.exec(accountNumber)?.[1];
	if (branch === undefined) {
		return null;
	}
	const transfer =
		/^Virement - AccesD Internet \/(?:a|de) (\d+)[ -]([A-Z]{2,4})\b/i.exec(
			plain,
		);
	if (transfer) {
		const [, folio = "", kind = ""] = transfer;
		return {
			kind: "account",
			number: `desjardins:${branch}:${Number(folio)}:${kind.toUpperCase()}`,
		};
	}
	const bill = /^Paiement facture - AccesD Internet \/(.+)$/i.exec(plain);
	if (bill?.[1]) {
		return { kind: "card", name: bill[1] };
	}
	return /^Retrait au GA\b/i.test(plain) ? { kind: "cash" } : null;
}
