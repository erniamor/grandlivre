import type {
	Account,
	Tag,
	Transaction,
	UpdateTransaction,
} from "@repo/schemas";
import { Button } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { FormAlert } from "@/components/FormAlert";
import { SelectField, type SelectOption } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { buildTagTree, flattenTagTree } from "@/features/tags/tag-tree";
import { useLastAccountId } from "@/features/transactions/last-account";
import { TransactionLinesField } from "@/features/transactions/TransactionLinesField";
import { TransactionTypeField } from "@/features/transactions/TransactionTypeField";
import {
	draftOf,
	emptyLine,
	type TransactionDraft,
	toTransactionInput,
	writableAccounts,
} from "@/features/transactions/transaction-form";
import { useLocalToday } from "@/features/transactions/use-local-today";
import { errorMessage, formErrors } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface TransactionFormProps {
	/** The household's currency, in which the amounts are typed. */
	currency: string;
	/** Every account of the household. */
	accounts: Account[];
	tags: Tag[];
	/** The transaction to change; without it, the form records one. */
	transaction?: Transaction;
	/** The account proposed for a new transaction, when the user holds it. */
	defaultAccountId?: string;
	submitLabel: string;
	save: (input: UpdateTransaction) => Promise<Transaction>;
	onSaved: (transaction: Transaction) => void | Promise<void>;
}

// A select's value is a string: this one stands for "nothing chosen"
const NONE = "";

/**
 * Records or changes a transaction: an expense or an income, in one line or
 * split into several, or a transfer between two accounts.
 */
export function TransactionForm({
	currency,
	accounts,
	tags,
	transaction,
	defaultAccountId,
	submitLabel,
	save,
	onSaved,
}: TransactionFormProps) {
	const locale = getLocale();
	const [draft, setDraft] = useState<TransactionDraft>(() =>
		transaction
			? draftOf(transaction, currency, locale)
			: {
					type: "expense",
					accountId: NONE,
					toAccountId: NONE,
					date: "",
					payee: "",
					note: "",
					lines: [emptyLine()],
				},
	);
	const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
	const mutation = useMutation({ mutationFn: save, onSuccess: onSaved });
	const apiErrors = mutation.error
		? formErrors(mutation.error)
		: { fields: {} as Record<string, string>, form: undefined };
	// The API names a transfer's amount "amount": it is the first line here
	const errors: Record<string, string> = {
		...apiErrors.fields,
		...(apiErrors.fields.amount
			? { "lines.0.amount": apiErrors.fields.amount }
			: {}),
		...localErrors,
	};

	// Until the user chooses: the account asked for, the one they last
	// recorded on, or their first one; and today
	const mine = writableAccounts(accounts);
	const lastAccountId = useLastAccountId();
	const today = useLocalToday();
	const proposedAccountId =
		[defaultAccountId, lastAccountId, mine[0]?.id].find((id) =>
			mine.some((account) => account.id === id),
		) ?? NONE;
	const current: TransactionDraft = {
		...draft,
		accountId: draft.accountId || proposedAccountId,
		date: draft.date || today,
	};
	const change = (fields: Partial<TransactionDraft>) =>
		setDraft({ ...current, ...fields });

	const isTransfer = current.type === "transfer";
	const accountOptions = mine.map((account) => ({
		value: account.id,
		label: account.name,
	}));
	const destinationOptions: SelectOption<string>[] = [
		{ value: NONE, label: m.transaction_choose_account() },
		...accounts
			.filter(
				(account) => !account.archived && account.id !== current.accountId,
			)
			.map((account) => ({ value: account.id, label: account.name })),
	];
	const tagOptions: SelectOption<string>[] = [
		{ value: NONE, label: m.transaction_uncategorized() },
		...flattenTagTree(buildTagTree(tags, locale)).map(({ tag, path }) => ({
			value: tag.id,
			label: path,
		})),
	];

	return (
		<form
			noValidate
			className="grid gap-6"
			onSubmit={(event) => {
				event.preventDefault();
				const result = toTransactionInput(current, currency, locale);
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
			<TransactionTypeField
				value={current.type}
				onChange={(type) => change({ type })}
			/>
			<TransactionLinesField
				lines={current.lines}
				onChange={(lines) => change({ lines })}
				tagOptions={tagOptions}
				currency={currency}
				amountOnly={isTransfer}
				errors={errors}
			/>
			<FormAlert message={errors.lines} />
			<div className="grid gap-2">
				<SelectField
					label={
						isTransfer
							? m.transaction_from_account_label()
							: m.transaction_account_label()
					}
					value={current.accountId}
					options={accountOptions}
					onChange={(accountId) =>
						change({
							accountId,
							// A transfer can't go to the account it leaves
							toAccountId:
								accountId === current.toAccountId ? NONE : current.toAccountId,
						})
					}
					tone="default"
					className="grid items-stretch font-medium"
				/>
				<FormAlert message={errors.accountId} />
			</div>
			{isTransfer && (
				<div className="grid gap-2">
					<SelectField
						label={m.transaction_to_account_label()}
						value={current.toAccountId}
						options={destinationOptions}
						onChange={(toAccountId) => change({ toAccountId })}
						tone="default"
						className="grid items-stretch font-medium"
					/>
					<FormAlert message={errors.toAccountId} />
				</div>
			)}
			<TextField
				label={m.transaction_date_label()}
				type="date"
				value={current.date}
				onChange={(event) => change({ date: event.target.value })}
				required
				error={errors.date}
			/>
			{!isTransfer && (
				<TextField
					label={
						current.type === "income"
							? m.transaction_payer_label()
							: m.transaction_payee_label()
					}
					autoComplete="off"
					value={current.payee}
					onChange={(event) => change({ payee: event.target.value })}
					error={errors.payee}
				/>
			)}
			<TextField
				label={m.transaction_note_label()}
				autoComplete="off"
				value={current.note}
				onChange={(event) => change({ note: event.target.value })}
				error={errors.note}
			/>
			<FormAlert message={apiErrors.form} />
			<Button type="submit" disabled={mutation.isPending}>
				{submitLabel}
			</Button>
		</form>
	);
}
