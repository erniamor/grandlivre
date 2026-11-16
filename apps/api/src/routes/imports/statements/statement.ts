import type { AccountType } from "@repo/schemas";

/** One line of a statement: money in or out of the account, on a day. */
export interface StatementLine {
	/** The day, as YYYY-MM-DD. */
	date: string;
	/** In minor units: positive when money comes in, negative when it goes out. */
	amount: number;
	/** As the bank wrote it, its spaces collapsed. */
	description: string;
	/** Who was paid or paid: the description's useful part. */
	payee: string;
	/**
	 * The line's identity, the same in every export of the account: banks
	 * like Desjardins give none that lasts, so it is derived from the day,
	 * the amount and the description (see `fingerprint.ts`).
	 */
	externalId: string;
}

/** One account (or card) found in a statement file, with its lines. */
export interface StatementAccount {
	/**
	 * What tells the account apart at the bank (its number, a card's last
	 * digits and name): never shown nor stored as is.
	 */
	number: string;
	/** The bank's name for it: a branch, a card's product. */
	bankName: string;
	/** The last digits of its number, to recognize it. */
	numberEnd: string;
	/** The kind of account it looks like. */
	type: AccountType;
	/** Oldest first, in the order the money moved. */
	lines: StatementLine[];
	/**
	 * Its balance before the first line, then after the last one, in minor
	 * units, negative for money owed; null when the file doesn't say.
	 */
	openingBalance: number | null;
	closingBalance: number | null;
}

export type StatementFormat = "desjardins_accounts" | "desjardins_cards";

export interface Statement {
	format: StatementFormat;
	accounts: StatementAccount[];
}

/** Why a file can't be read, as an error code for the front ends. */
export type StatementError =
	| "statement_unreadable"
	| "statement_empty"
	| "statement_too_long";

export type StatementResult =
	| { ok: true; statement: Statement }
	| { ok: false; error: StatementError; line?: number };
