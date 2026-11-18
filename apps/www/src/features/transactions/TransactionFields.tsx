import type { Account, Tag } from "@repo/schemas";
import type { ReactNode } from "react";
import { FormAlert } from "@/components/FormAlert";
import { SelectField, type SelectOption } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { HelpHint } from "@/features/help/HelpHint";
import type { ExtraTagChoice } from "@/features/tags/TagBrowser";
import { buildTagTree } from "@/features/tags/tag-tree";
import { TransactionLinesField } from "@/features/transactions/TransactionLinesField";
import { TransactionTypeField } from "@/features/transactions/TransactionTypeField";
import {
	type TransactionFormState,
	writableAccounts,
} from "@/features/transactions/transaction-form";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface TransactionFieldsProps {
	value: TransactionFormState;
	onChange: (fields: Partial<TransactionFormState>) => void;
	/** Every account of the household. */
	accounts: Account[];
	tags: Tag[];
	/** The household's currency, in which the amounts are typed. */
	currency: string;
	/** Messages by field, named as the API names them ("lines.0.amount"). */
	errors: Record<string, string>;
	/** Tag choices offered before the household's: the proposed tag. */
	extraTagOptions?: ExtraTagChoice[];
	/** Shown between the type and the lines: the proposed tag's panel. */
	aside?: ReactNode;
	/** Shown after the accounts: the day of a transaction, or a schedule. */
	when?: ReactNode;
}

// A select's value is a string: this one stands for "nothing chosen"
const NONE = "";

/**
 * What a transaction is made of: its type, its lines, its accounts, who was
 * paid and a note. Shared by the forms of a transaction and of a recurring
 * one, which hold the state.
 */
export function TransactionFields({
	value,
	onChange,
	accounts,
	tags,
	currency,
	errors,
	extraTagOptions = [],
	aside,
	when,
}: TransactionFieldsProps) {
	const locale = getLocale();
	const isTransfer = value.type === "transfer";
	const accountOptions = writableAccounts(accounts).map((account) => ({
		value: account.id,
		label: account.name,
	}));
	const destinationOptions: SelectOption<string>[] = [
		{ value: NONE, label: m.transaction_choose_account() },
		...accounts
			.filter((account) => !account.archived && account.id !== value.accountId)
			.map((account) => ({ value: account.id, label: account.name })),
	];
	const tagTree = buildTagTree(tags, locale);

	return (
		<>
			<div className="flex items-center gap-1 [&>fieldset]:flex-1">
				<TransactionTypeField
					value={value.type}
					onChange={(type) => onChange({ type })}
				/>
				<HelpHint topic="transfer" />
			</div>
			{aside}
			<TransactionLinesField
				lines={value.lines}
				onChange={(lines) => onChange({ lines })}
				tagTree={tagTree}
				extraTags={extraTagOptions}
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
					value={value.accountId}
					options={accountOptions}
					onChange={(accountId) =>
						onChange({
							accountId,
							// A transfer can't go to the account it leaves
							toAccountId:
								accountId === value.toAccountId ? NONE : value.toAccountId,
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
						value={value.toAccountId}
						options={destinationOptions}
						onChange={(toAccountId) => onChange({ toAccountId })}
						tone="default"
						className="grid items-stretch font-medium"
					/>
					<FormAlert message={errors.toAccountId} />
				</div>
			)}
			{when}
			{!isTransfer && (
				<TextField
					label={
						value.type === "income"
							? m.transaction_payer_label()
							: m.transaction_payee_label()
					}
					autoComplete="off"
					value={value.payee}
					onChange={(event) => onChange({ payee: event.target.value })}
					error={errors.payee}
				/>
			)}
			<TextField
				label={m.transaction_note_label()}
				autoComplete="off"
				value={value.note}
				onChange={(event) => onChange({ note: event.target.value })}
				error={errors.note}
			/>
		</>
	);
}
