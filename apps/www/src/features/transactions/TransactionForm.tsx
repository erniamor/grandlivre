import type {
	Account,
	ProposedTag,
	ShareSplit,
	Tag,
	Transaction,
	TransactionDraft,
	UpdateTransaction,
} from "@repo/schemas";
import { Button } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { FormAlert } from "@/components/FormAlert";
import { TextField } from "@/components/TextField";
import { SharesField } from "@/features/sharing/SharesField";
import { shareStateOf, toShareSplit } from "@/features/sharing/share-form";
import type { SharingContext } from "@/features/sharing/sharing-query";
import type { ExtraTagChoice } from "@/features/tags/TagBrowser";
import { useLastAccountId } from "@/features/transactions/last-account";
import { ProposedTagPanel } from "@/features/transactions/ProposedTagPanel";
import { TransactionFields } from "@/features/transactions/TransactionFields";
import {
	canBeUndetermined,
	emptyLine,
	formStateOf,
	formStateOfDraft,
	PROPOSED_TAG,
	type TransactionFormState,
	toTransactionInput,
	usesProposedTag,
	writableAccounts,
} from "@/features/transactions/transaction-form";
import { UndeterminedField } from "@/features/transactions/UndeterminedField";
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
	/** The members and the default split, when the household shares expenses. */
	sharing?: SharingContext;
	/** How a new transaction starts shared: as its recurring transaction says. */
	initialShares?: ShareSplit;
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
	sharing,
	initialShares,
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
	const [shares, setShares] = useState(() =>
		shareStateOf(
			transaction?.sharing?.split ?? initialShares,
			sharing?.weights ?? [],
			currency,
			locale,
		),
	);
	// Set aside as undetermined: only a transaction already recorded
	const [undetermined, setUndetermined] = useState(
		transaction?.undetermined ?? false,
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
	const undeterminable =
		transaction !== undefined && canBeUndetermined(current);
	// Shared: an expense or a refund paid from one member's own account
	const shareable =
		sharing !== undefined &&
		current.type !== "transfer" &&
		accounts.find((account) => account.id === current.accountId)?.holders
			.length === 1;

	const proposedTagOption: ExtraTagChoice[] = proposal
		? [
				{
					value: PROPOSED_TAG,
					label: m.proposed_tag_option({ name: proposal.names[locale] }),
				},
			]
		: [];
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
			!/^(lines\.|amount$|accountId$|toAccountId$|date$|payee$|note$|shares$)/.test(
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
				let input = result.input;
				if (input.type !== "transfer" && transaction) {
					input = { ...input, undetermined: undeterminable && undetermined };
				}
				if (input.type !== "transfer" && sharing) {
					if (shareable && shares.on) {
						const split = toShareSplit(
							shares,
							sharing.members.map((member) => member.userId),
							currency,
							locale,
						);
						if (!split.ok) {
							setLocalErrors({ shares: errorMessage(split.error) });
							return;
						}
						input = { ...input, shares: split.split };
					} else if (transaction?.sharing) {
						// Shared before, no longer
						input = { ...input, shares: null };
					}
				}
				setLocalErrors({});
				mutation.mutate({
					input,
					proposedTag: proposal && usesProposedTag(current) ? proposal : null,
				});
			}}
		>
			<TransactionFields
				value={current}
				onChange={change}
				accounts={accounts}
				tags={tags}
				currency={currency}
				errors={errors}
				extraTagOptions={proposedTagOption}
				aside={
					proposal &&
					usesProposedTag(current) && (
						<ProposedTagPanel
							proposal={proposal}
							tags={tags}
							onUseTag={leaveProposal}
							onDismiss={() => leaveProposal(NONE)}
						/>
					)
				}
				when={
					<TextField
						label={m.transaction_date_label()}
						type="date"
						value={current.date}
						onChange={(event) => change({ date: event.target.value })}
						required
						error={errors.date}
					/>
				}
			/>
			{shareable && sharing && (
				<SharesField
					value={shares}
					onChange={(next) =>
						setShares(
							// Turned on: from the default split, as it is now
							next.on && !shares.on
								? {
										...shareStateOf(
											undefined,
											sharing.weights,
											currency,
											locale,
										),
										on: true,
									}
								: next,
						)
					}
					context={sharing}
					error={errors.shares}
				/>
			)}
			{undeterminable && (
				<UndeterminedField checked={undetermined} onChange={setUndetermined} />
			)}
			<FormAlert message={apiErrors.form ?? unshownError} />
			<Button type="submit" disabled={mutation.isPending}>
				{submitLabel}
			</Button>
		</form>
	);
}
