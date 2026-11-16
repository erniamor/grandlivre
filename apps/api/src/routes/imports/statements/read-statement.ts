import { parseCsv } from "@/routes/imports/statements/csv";
import { decodeStatement } from "@/routes/imports/statements/decode";
import {
	desjardinsAccounts,
	desjardinsCards,
	readAccountRow,
	readCardRow,
} from "@/routes/imports/statements/desjardins";
import type {
	StatementAccount,
	StatementFormat,
	StatementResult,
} from "@/routes/imports/statements/statement";

/** The most lines a statement file may hold. */
export const STATEMENT_MAX_LINES = 2000;

/**
 * Every row read by `read`, then made into accounts; or the number of the
 * first row that can't be read (from 1, blank lines left out).
 */
function readAll<Row>(
	rows: string[][],
	read: (fields: string[]) => Row | null,
	accounts: (rows: Row[]) => StatementAccount[],
): StatementAccount[] | number {
	const read_: Row[] = [];
	for (const [at, fields] of rows.entries()) {
		const row = read(fields);
		if (row === null) {
			return at + 1;
		}
		read_.push(row);
	}
	return accounts(read_);
}

/**
 * Reads a statement file: its format is told by its first line, then every
 * line must be of that format.
 */
export function readStatement(bytes: Uint8Array): StatementResult {
	const rows = parseCsv(decodeStatement(bytes));
	const [first] = rows;
	if (!first) {
		return { ok: false, error: "statement_empty" };
	}
	if (rows.length > STATEMENT_MAX_LINES) {
		return { ok: false, error: "statement_too_long" };
	}
	let format: StatementFormat;
	let result: StatementAccount[] | number;
	if (readAccountRow(first)) {
		format = "desjardins_accounts";
		result = readAll(rows, readAccountRow, desjardinsAccounts);
	} else if (readCardRow(first)) {
		format = "desjardins_cards";
		result = readAll(rows, readCardRow, desjardinsCards);
	} else {
		return { ok: false, error: "statement_unreadable", line: 1 };
	}
	return typeof result === "number"
		? { ok: false, error: "statement_unreadable", line: result }
		: { ok: true, statement: { format, accounts: result } };
}
