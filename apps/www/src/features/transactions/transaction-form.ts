import type {
	Account,
	CreateTransaction,
	Transaction,
	TransactionDraft,
	TransactionType,
	UpdateTransaction,
} from "@repo/schemas";
import { formatAmountInput, parseAmount } from "@/lib/money";

/** One line of the form: what the user typed, before it is checked. */
export interface LineDraft {
	/** Identifies the line while it is edited. */
	key: string;
	/** As typed: "72", "72,50". */
	amount: string;
	/** Empty for an uncategorized line. */
	tagId: string;
}

/** The transaction as the form holds it. */
export interface TransactionFormState {
	type: TransactionType;
	/** Empty while no account is chosen. */
	accountId: string;
	/** For a transfer; empty while no account is chosen. */
	toAccountId: string;
	/** A calendar day, "2026-11-14"; empty while unknown. */
	date: string;
	payee: string;
	note: string;
	/**
	 * At least one. An expense or an income is the sum of its lines; a
	 * transfer only uses the amount of the first.
	 */
	lines: LineDraft[];
}

/**
 * The value a line's tag takes while it is on the tag the assistant
 * proposed: the tag doesn't exist yet, it is created on saving.
 */
export const PROPOSED_TAG = "proposed";

let nextKey = 0;

export function emptyLine(): LineDraft {
	nextKey += 1;
	return { key: `line-${nextKey}`, amount: "", tagId: "" };
}

/** The form's content for a transaction that exists. */
export function formStateOf(
	transaction: Transaction,
	currency: string,
	locale: string,
): TransactionFormState {
	const amountText = (amount: number) =>
		formatAmountInput(amount, currency, locale);
	return {
		type: transaction.type,
		accountId: transaction.accountId,
		toAccountId: transaction.toAccountId ?? "",
		date: transaction.date,
		payee: transaction.payee ?? "",
		note: transaction.note ?? "",
		lines:
			transaction.type === "transfer"
				? [{ ...emptyLine(), amount: amountText(transaction.amount) }]
				: transaction.lines.map((line) => ({
						...emptyLine(),
						amount: amountText(line.amount),
						tagId: line.tagId ?? "",
					})),
	};
}

type DraftResult =
	| { ok: true; input: UpdateTransaction }
	| {
			ok: false;
			/** Error codes by field, named as the API names them ("lines.0.amount"). */
			errors: Record<string, string>;
	  };

/** A positive amount in minor units, or the code of what is wrong with it. */
function readAmount(
	text: string,
	currency: string,
	locale: string,
): { amount: number } | { error: string } {
	const amount = parseAmount(text, currency, locale);
	if (amount === null) {
		return { error: "amount_invalid" };
	}
	return amount > 0 ? { amount } : { error: "amount_not_positive" };
}

/**
 * What the form sends, from what the user typed; or the errors to show
 * next to the fields that can't be read.
 */
export function toTransactionInput(
	draft: TransactionFormState,
	currency: string,
	locale: string,
): DraftResult {
	const errors: Record<string, string> = {};
	if (!draft.accountId) {
		errors.accountId = "transaction_account_required";
	}
	if (!draft.date) {
		errors.date = "date_invalid";
	}
	const common = {
		accountId: draft.accountId,
		date: draft.date,
		note: draft.note.trim() || null,
	};

	if (draft.type === "transfer") {
		const read = readAmount(draft.lines[0]?.amount ?? "", currency, locale);
		if ("error" in read) {
			errors["lines.0.amount"] = read.error;
		}
		if (!draft.toAccountId) {
			errors.toAccountId = "transaction_account_required";
		}
		if ("error" in read || Object.keys(errors).length > 0) {
			return { ok: false, errors };
		}
		return {
			ok: true,
			input: {
				...common,
				type: "transfer",
				toAccountId: draft.toAccountId,
				amount: read.amount,
			},
		};
	}

	const lines = draft.lines.map((line, index) => {
		const read = readAmount(line.amount, currency, locale);
		if ("error" in read) {
			errors[`lines.${index}.amount`] = read.error;
			return { amount: 0, tagId: null };
		}
		return { amount: read.amount, tagId: line.tagId || null };
	});
	if (Object.keys(errors).length > 0) {
		return { ok: false, errors };
	}
	return {
		ok: true,
		input: {
			...common,
			type: draft.type,
			payee: draft.payee.trim() || null,
			lines,
		},
	};
}

/**
 * The sum of the lines in minor units, or null while one of them can't be
 * read: shown under a split transaction.
 */
export function draftTotal(
	lines: LineDraft[],
	currency: string,
	locale: string,
): number | null {
	let total = 0;
	for (const line of lines) {
		const amount = parseAmount(line.amount, currency, locale);
		if (amount === null) {
			return null;
		}
		total += amount;
	}
	return total;
}

/** The accounts the signed-in user may record a transaction on. */
export function writableAccounts(accounts: Account[]): Account[] {
	return accounts.filter((account) => account.isHolder && !account.archived);
}

/**
 * Whether the signed-in user may change or delete a transaction: they hold
 * the account it was recorded on, and that account isn't archived.
 */
export function canEditTransaction(
	transaction: Transaction,
	accounts: Account[],
): boolean {
	return writableAccounts(accounts).some(
		(account) => account.id === transaction.accountId,
	);
}

/** The form's content for a draft of the assistant, to review. */
export function formStateOfDraft(
	draft: TransactionDraft,
	currency: string,
	locale: string,
): TransactionFormState {
	return {
		type: draft.type,
		// Empty: the form proposes the account the user last recorded on
		accountId: draft.accountId ?? "",
		toAccountId: draft.toAccountId ?? "",
		date: draft.date,
		payee: draft.payee ?? "",
		note: draft.note ?? "",
		lines: draft.lines.map((line) => ({
			...emptyLine(),
			amount: formatAmountInput(line.amount, currency, locale),
			tagId: line.usesProposedTag ? PROPOSED_TAG : (line.tagId ?? ""),
		})),
	};
}

/**
 * Whether the transaction can be set aside as undetermined: an expense or
 * an income none of whose lines has a tag.
 */
export function canBeUndetermined(state: TransactionFormState): boolean {
	return (
		state.type !== "transfer" && state.lines.every((line) => line.tagId === "")
	);
}

/** Whether some line of the form is on the proposed tag. */
export function usesProposedTag(state: TransactionFormState): boolean {
	return (
		state.type !== "transfer" &&
		state.lines.some((line) => line.tagId === PROPOSED_TAG)
	);
}

/** The transaction to send, its lines on the proposed tag now on the tag created. */
export function withCreatedTag(
	input: UpdateTransaction,
	tagId: string,
): UpdateTransaction {
	if (input.type === "transfer") {
		return input;
	}
	return {
		...input,
		lines: input.lines.map((line) =>
			line.tagId === PROPOSED_TAG ? { ...line, tagId } : line,
		),
	};
}

/**
 * The transaction to record, with where it comes from: the form alone
 * (`manual`), a note (`voice`) or a receipt (`receipt`), whose details are
 * kept with an expense or an income.
 */
export function withOrigin(
	input: UpdateTransaction,
	draft: TransactionDraft | undefined,
): CreateTransaction {
	if (!draft) {
		return { ...input, origin: "manual" };
	}
	if (!draft.receipt) {
		return { ...input, origin: "voice" };
	}
	return input.type === "transfer"
		? { ...input, origin: "receipt" }
		: { ...input, origin: "receipt", receipt: draft.receipt };
}
