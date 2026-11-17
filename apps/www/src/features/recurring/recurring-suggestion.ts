import type {
	RecurringSuggestion,
	RecurringSuggestionKey,
	RecurringTransaction,
} from "@repo/schemas";
import {
	emptyRecurringState,
	type RecurringFormState,
} from "@/features/recurring/recurring-form";
import { emptyLine } from "@/features/transactions/transaction-form";
import { formatAmountInput } from "@/lib/money";

/** What tells a suggestion apart, as a dismissal names it. */
export function suggestionKeyOf(
	suggestion: RecurringSuggestion,
): RecurringSuggestionKey {
	return {
		accountId: suggestion.accountId,
		toAccountId: suggestion.toAccountId,
		type: suggestion.type,
		key: suggestion.key,
		unit: suggestion.unit,
		interval: suggestion.interval,
		startDate: suggestion.nextDate,
	};
}

/** A suggestion's id in a URL: what tells it apart, in one string. */
export function suggestionId(suggestion: RecurringSuggestion): string {
	const key = suggestionKeyOf(suggestion);
	return [
		key.accountId,
		key.toAccountId ?? "",
		key.type,
		key.key,
		key.unit,
		key.interval,
		key.startDate,
	].join(".");
}

/** The suggestion of that id, if it is still offered. */
export function findSuggestion(
	suggestions: RecurringSuggestion[],
	id: string,
): RecurringSuggestion | undefined {
	return suggestions.find((suggestion) => suggestionId(suggestion) === id);
}

/** What a suggestion would record, as a recurring transaction does. */
export function templateOfSuggestion(
	suggestion: RecurringSuggestion,
): RecurringTransaction["transaction"] {
	return {
		type: suggestion.type,
		accountId: suggestion.accountId,
		toAccountId: suggestion.toAccountId,
		amount: suggestion.amount,
		payee: suggestion.payee,
		note: null,
		lines:
			suggestion.type === "transfer"
				? []
				: [{ amount: suggestion.amount, tagId: suggestion.tagId }],
	};
}

/**
 * The recurring form filled from a suggestion: what it records, on its
 * cadence, from the next day it is expected on, recorded on its own when
 * its amount is steady.
 */
export function recurringStateOfSuggestion(
	suggestion: RecurringSuggestion,
	currency: string,
	locale: string,
): RecurringFormState {
	const state = emptyRecurringState(suggestion.nextDate);
	return {
		transaction: {
			...state.transaction,
			type: suggestion.type,
			accountId: suggestion.accountId,
			toAccountId: suggestion.toAccountId ?? "",
			payee: suggestion.payee ?? "",
			lines: [
				{
					...emptyLine(),
					amount: formatAmountInput(suggestion.amount, currency, locale),
					tagId: suggestion.tagId ?? "",
				},
			],
		},
		schedule: {
			...state.schedule,
			unit: suggestion.unit,
			interval: String(suggestion.interval),
		},
		mode: suggestion.mode,
	};
}
