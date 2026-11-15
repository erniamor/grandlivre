import type {
	Account,
	AccountType,
	AccountVisibility,
	HouseholdMember,
} from "@repo/schemas";
import { Button } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { FormAlert } from "@/components/FormAlert";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import {
	type AccountFormInput,
	isDebtType,
	toBalanceText,
	toOpeningBalance,
} from "@/features/accounts/account-form";
import {
	accountTypeOptions,
	accountVisibilityOptions,
} from "@/features/accounts/account-options";
import { HoldersField } from "@/features/accounts/HoldersField";
import { formErrors } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface AccountFormProps {
	/** The household's currency, in which the balance is typed. */
	currency: string;
	members: HouseholdMember[];
	/** Identifier of the signed-in user. */
	meId: string;
	/** The account to change; without it, the form creates one. */
	account?: Account;
	submitLabel: string;
	save: (input: AccountFormInput) => Promise<Account>;
	onSaved: (account: Account) => void | Promise<void>;
}

/** Creates or changes an account: name, type, balance, holders, visibility. */
export function AccountForm({
	currency,
	members,
	meId,
	account,
	submitLabel,
	save,
	onSaved,
}: AccountFormProps) {
	const locale = getLocale();
	const [type, setType] = useState<AccountType>(account?.type ?? "checking");
	const [visibility, setVisibility] = useState<AccountVisibility>(
		account?.visibility ?? "details",
	);
	const [holderIds, setHolderIds] = useState(
		account ? account.holders.map((holder) => holder.userId) : [meId],
	);
	const [balanceError, setBalanceError] = useState<string>();
	const mutation = useMutation({ mutationFn: save, onSuccess: onSaved });
	const errors = mutation.error ? formErrors(mutation.error) : { fields: {} };

	// Null: the user sees the account's balance but not its opening balance
	const showsBalance = !account || account.openingBalance !== null;
	const initialBalance =
		account?.openingBalance == null
			? undefined
			: toBalanceText(account.openingBalance, account.type, currency, locale);
	const isDebt = isDebtType(type);

	return (
		<form
			noValidate
			className="grid gap-6"
			onSubmit={(event) => {
				event.preventDefault();
				const data = new FormData(event.currentTarget);
				const input: AccountFormInput = {
					name: String(data.get("name") ?? ""),
					type,
					visibility,
					holderIds,
				};
				if (showsBalance) {
					const openingBalance = toOpeningBalance(
						String(data.get("balance") ?? ""),
						type,
						currency,
						locale,
					);
					if (openingBalance === null) {
						setBalanceError(m.error_amount_invalid());
						return;
					}
					input.openingBalance = openingBalance;
				}
				setBalanceError(undefined);
				mutation.mutate(input);
			}}
		>
			<TextField
				label={m.account_name_label()}
				name="name"
				autoComplete="off"
				defaultValue={account?.name}
				required
				error={errors.fields.name}
			/>
			<SelectField
				label={m.account_type_label()}
				value={type}
				options={accountTypeOptions()}
				onChange={setType}
				tone="default"
				className="grid items-stretch font-medium"
			/>
			{showsBalance && (
				<div className="grid gap-2">
					<TextField
						label={
							isDebt
								? m.account_amount_owed_label()
								: m.account_opening_balance_label()
						}
						name="balance"
						inputMode="decimal"
						autoComplete="off"
						defaultValue={initialBalance}
						required
						error={balanceError ?? errors.fields.openingBalance}
					/>
					<p className="text-muted-foreground text-sm">
						{isDebt
							? m.account_amount_owed_hint()
							: m.account_opening_balance_hint()}
					</p>
				</div>
			)}
			<HoldersField
				members={members}
				value={holderIds}
				onChange={setHolderIds}
				lockedId={account ? undefined : meId}
				error={errors.fields.holderIds}
			/>
			<SelectField
				label={m.account_visibility_label()}
				value={visibility}
				options={accountVisibilityOptions()}
				onChange={setVisibility}
				tone="default"
				className="grid items-stretch font-medium"
			/>
			<FormAlert message={errors.form} />
			<Button type="submit" disabled={mutation.isPending}>
				{submitLabel}
			</Button>
		</form>
	);
}
