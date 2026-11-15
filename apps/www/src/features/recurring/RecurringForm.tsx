import type {
	Account,
	CreateRecurringTransaction,
	RecurringTransaction,
	Tag,
	Transaction,
} from "@repo/schemas";
import { Button } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { FormAlert } from "@/components/FormAlert";
import { RecurringModeField } from "@/features/recurring/RecurringModeField";
import {
	emptyRecurringState,
	formFieldsOf,
	formStateOfRecurring,
	type RecurringFormState,
	recurringStateOfTransaction,
	toRecurringInput,
} from "@/features/recurring/recurring-form";
import { ScheduleFields } from "@/features/recurring/ScheduleFields";
import { TransactionFields } from "@/features/transactions/TransactionFields";
import { writableAccounts } from "@/features/transactions/transaction-form";
import { todayIn } from "@/lib/dates";
import { errorMessage, formErrors } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface RecurringFormProps {
	currency: string;
	/** The household's time zone: its today is the earliest first day. */
	timeZone: string;
	/** Every account of the household. */
	accounts: Account[];
	tags: Tag[];
	/** The recurring transaction to change; without it, the form creates one. */
	recurring?: RecurringTransaction;
	/** A transaction to make recurring: the new one starts from it. */
	from?: Transaction;
	/** The account proposed for a new one, when the user holds it. */
	defaultAccountId?: string;
	submitLabel: string;
	save: (input: CreateRecurringTransaction) => Promise<RecurringTransaction>;
	onSaved: (recurring: RecurringTransaction) => void | Promise<void>;
}

/**
 * Creates or changes a recurring transaction: what it records, when, and
 * whether it is recorded on its own or waits to be confirmed.
 */
export function RecurringForm({
	currency,
	timeZone,
	accounts,
	tags,
	recurring,
	from,
	defaultAccountId,
	submitLabel,
	save,
	onSaved,
}: RecurringFormProps) {
	const locale = getLocale();
	const today = todayIn(timeZone);
	const [state, setState] = useState<RecurringFormState>(() =>
		recurring
			? formStateOfRecurring(recurring, currency, locale)
			: from
				? recurringStateOfTransaction(from, currency, locale, today)
				: emptyRecurringState(today),
	);
	const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
	const mutation = useMutation({ mutationFn: save, onSuccess: onSaved });
	const apiErrors = mutation.error
		? formErrors(mutation.error)
		: { fields: {} as Record<string, string>, form: undefined };
	const apiFields = formFieldsOf(apiErrors.fields);
	const errors: Record<string, string> = {
		...apiFields,
		// The API names a transfer's amount "amount": it is the first line here
		...(apiFields.amount ? { "lines.0.amount": apiFields.amount } : {}),
		...localErrors,
	};

	// Until the user chooses: the account asked for, or their first one
	const mine = writableAccounts(accounts);
	const transaction = {
		...state.transaction,
		accountId:
			state.transaction.accountId ||
			([defaultAccountId, mine[0]?.id].find((id) =>
				mine.some((account) => account.id === id),
			) ??
				""),
	};
	const current = { ...state, transaction };

	return (
		<form
			noValidate
			className="grid gap-6"
			onSubmit={(event) => {
				event.preventDefault();
				const result = toRecurringInput(
					current,
					currency,
					locale,
					today,
					recurring?.schedule,
				);
				if (!result.ok) {
					setLocalErrors(
						Object.fromEntries(
							Object.entries(result.errors).map(([field, code]) => [
								field,
								errorMessage(code),
							]),
						),
					);
					return;
				}
				setLocalErrors({});
				mutation.mutate(result.input);
			}}
		>
			<TransactionFields
				value={transaction}
				onChange={(fields) =>
					setState({ ...current, transaction: { ...transaction, ...fields } })
				}
				accounts={accounts}
				tags={tags}
				currency={currency}
				errors={errors}
				when={
					<ScheduleFields
						value={current.schedule}
						onChange={(fields) =>
							setState({
								...current,
								schedule: { ...current.schedule, ...fields },
							})
						}
						errors={errors}
					/>
				}
			/>
			<RecurringModeField
				value={current.mode}
				onChange={(mode) => setState({ ...current, mode })}
			/>
			<FormAlert message={apiErrors.form} />
			<Button type="submit" disabled={mutation.isPending}>
				{submitLabel}
			</Button>
			<p className="text-muted-foreground text-sm">{m.recurring_form_hint()}</p>
		</form>
	);
}
