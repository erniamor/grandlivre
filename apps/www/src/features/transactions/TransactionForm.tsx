import type {
	Account,
	ProposedTag,
	Tag,
	Transaction,
	TransactionDraft,
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
import { ProposedTagPanel } from "@/features/transactions/ProposedTagPanel";
import { TransactionLinesField } from "@/features/transactions/TransactionLinesField";
import { TransactionTypeField } from "@/features/transactions/TransactionTypeField";
import {
	emptyLine,
	formStateOf,
	formStateOfDraft,
	PROPOSED_TAG,
	type TransactionFormState,
	toTransactionInput,
	usesProposedTag,
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
	/** A draft of the assistant, to review: the form starts from it. */
	draft?: TransactionDraft;
	submitLabel: string;
	/**
	 * Saves the transaction. `proposedTag` is the tag the assistant proposed,
	 * when lines are still on it: to create first (their tag is `PROPOSED_TAG`).
	 */
	save: (
		input: UpdateTransaction,
		proposedTag: ProposedTag | null,
	) => Promise<Transaction>;
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
	draft: noteDraft,
	submitLabel,
	save,
	onSaved,
}: TransactionFormProps) {
	const locale = getLocale();
	const [draft, setDraft] = useState<TransactionFormState>(() =>
		transaction
			? formStateOf(transaction, currency, locale)
			: noteDraft
				? formStateOfDraft(noteDraft, currency, locale)
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
	// The tag the assistant proposed, until the user turns it down
	const [proposal, setProposal] = useState(noteDraft?.proposedTag ?? null);
	const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
	const mutation = useMutation({
		mutationFn: ({
			input,
			proposedTag,
		}: {
			input: UpdateTransaction;
			proposedTag: ProposedTag | null;
		}) => save(input, proposedTag),
		onSuccess: onSaved,
	});
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
	const current: TransactionFormState = {
		...draft,
		accountId: draft.accountId || proposedAccountId,
		date: draft.date || today,
	};
	const change = (fields: Partial<TransactionFormState>) =>
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
		...(proposal
			? [
					{
						value: PROPOSED_TAG,
						label: m.proposed_tag_option({ name: proposal.names[locale] }),
					},
				]
			: []),
		...flattenTagTree(buildTagTree(tags, locale)).map(({ tag, path }) => ({
			value: tag.id,
			label: path,
		})),
	];
	/** Moves the lines on the proposed tag to `tagId` ("" leaves them uncategorized). */
	const leaveProposal = (tagId: string) => {
		change({
			lines: current.lines.map((line) =>
				line.tagId === PROPOSED_TAG ? { ...line, tagId } : line,
			),
		});
		setProposal(null);
	};
	// An error about a field the form doesn't show (the proposed tag's
	// names, its parent): said for the whole form
	const unshownError = Object.entries(apiErrors.fields).find(
		([field]) =>
			!/^(lines\.|amount$|accountId$|toAccountId$|date$|payee$|note$)/.test(
				field,
			),
	)?.[1];

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
				mutation.mutate({
					input: result.input,
					proposedTag: proposal && usesProposedTag(current) ? proposal : null,
				});
			}}
		>
			<TransactionTypeField
				value={current.type}
				onChange={(type) => change({ type })}
			/>
			{proposal && usesProposedTag(current) && (
				<ProposedTagPanel
					proposal={proposal}
					tags={tags}
					onUseTag={leaveProposal}
					onDismiss={() => leaveProposal(NONE)}
				/>
			)}
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
			<FormAlert message={apiErrors.form ?? unshownError} />
			<Button type="submit" disabled={mutation.isPending}>
				{submitLabel}
			</Button>
		</form>
	);
}
