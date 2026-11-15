import type {
	CreateRecurringTransaction,
	RecurrenceMode,
	RecurrenceSchedule,
	RecurrenceUnit,
	RecurringTransaction,
} from "@repo/schemas";
import { RECURRENCE_MAX_INTERVAL } from "@repo/schemas";
import {
	emptyLine,
	type TransactionFormState,
	toTransactionInput,
} from "@/features/transactions/transaction-form";
import { formatAmountInput } from "@/lib/money";

/** The schedule as the form holds it, as typed. */
export interface ScheduleFormState {
	unit: RecurrenceUnit;
	/** As typed: "1", "2". */
	interval: string;
	/** A calendar day; empty while unknown. */
	startDate: string;
	/** Empty when it never ends. */
	endDate: string;
}

/** A recurring transaction as the form holds it. */
export interface RecurringFormState {
	/** What it records; its `date` isn't used: the schedule gives the days. */
	transaction: TransactionFormState;
	schedule: ScheduleFormState;
	mode: RecurrenceMode;
}

/** A new recurring transaction: monthly, to confirm, from `startDate`. */
export function emptyRecurringState(startDate = ""): RecurringFormState {
	return {
		transaction: {
			type: "expense",
			accountId: "",
			toAccountId: "",
			date: "",
			payee: "",
			note: "",
			lines: [emptyLine()],
		},
		schedule: { unit: "month", interval: "1", startDate, endDate: "" },
		mode: "confirm",
	};
}

/** The form's content for a recurring transaction that exists. */
export function formStateOfRecurring(
	{ transaction, schedule, mode }: RecurringTransaction,
	currency: string,
	locale: string,
): RecurringFormState {
	const amountText = (amount: number) =>
		formatAmountInput(amount, currency, locale);
	return {
		transaction: {
			type: transaction.type,
			accountId: transaction.accountId,
			toAccountId: transaction.toAccountId ?? "",
			date: "",
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
		},
		schedule: {
			unit: schedule.unit,
			interval: String(schedule.interval),
			startDate: schedule.startDate,
			endDate: schedule.endDate ?? "",
		},
		mode,
	};
}

type RecurringResult =
	| { ok: true; input: CreateRecurringTransaction }
	| {
			ok: false;
			/**
			 * Error codes by field: the transaction's as the form names them
			 * ("lines.0.amount"), the schedule's as the API ("schedule.startDate").
			 */
			errors: Record<string, string>;
	  };

/** Whether the schedule changes when, so its first day can't be past. */
function changesWhen(
	schedule: ScheduleFormState,
	interval: number,
	original: RecurrenceSchedule | undefined,
): boolean {
	return (
		!original ||
		original.unit !== schedule.unit ||
		original.interval !== interval ||
		original.startDate !== schedule.startDate
	);
}

/**
 * What the form sends, from what the user typed; or the errors to show.
 * `today` is the household's day; `original` the schedule of the recurring
 * transaction changed, whose past first day is kept when unchanged.
 */
export function toRecurringInput(
	{ transaction, schedule, mode }: RecurringFormState,
	currency: string,
	locale: string,
	today: string,
	original?: RecurrenceSchedule,
): RecurringResult {
	const errors: Record<string, string> = {};
	const read = toTransactionInput(
		{ ...transaction, date: schedule.startDate || today },
		currency,
		locale,
	);
	if (!read.ok) {
		Object.assign(errors, read.errors);
	}

	const interval = /^\d+$/.test(schedule.interval.trim())
		? Number(schedule.interval)
		: Number.NaN;
	if (!(interval >= 1 && interval <= RECURRENCE_MAX_INTERVAL)) {
		errors["schedule.interval"] = "recurrence_interval_invalid";
	}
	if (!schedule.startDate) {
		errors["schedule.startDate"] = "date_invalid";
	} else if (
		schedule.startDate < today &&
		changesWhen(schedule, interval, original)
	) {
		errors["schedule.startDate"] = "recurrence_start_in_past";
	}
	const endDate = schedule.endDate || null;
	if (endDate && schedule.startDate && endDate < schedule.startDate) {
		errors["schedule.endDate"] = "recurrence_end_before_start";
	}

	if (!read.ok || Object.keys(errors).length > 0) {
		return { ok: false, errors };
	}
	const { date: _date, ...template } = read.input;
	return {
		ok: true,
		input: {
			transaction: template,
			schedule: {
				unit: schedule.unit,
				interval,
				startDate: schedule.startDate,
				endDate,
			},
			mode,
		},
	};
}

/**
 * The API's errors by field, the transaction's named as the form names
 * them: "transaction.lines.0.tagId" is "lines.0.tagId".
 */
export function formFieldsOf(
	fields: Record<string, string>,
): Record<string, string> {
	return Object.fromEntries(
		Object.entries(fields).map(([field, message]) => [
			field.replace(/^transaction\./, ""),
			message,
		]),
	);
}
