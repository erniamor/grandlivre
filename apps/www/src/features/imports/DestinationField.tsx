import {
	ACCOUNT_DEBT_TYPES,
	type Account,
	type AccountType,
	type StatementPreviewAccount,
} from "@repo/schemas";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { accountTypeOptions } from "@/features/accounts/account-options";
import {
	type Destination,
	statementAccountName,
} from "@/features/imports/import-draft";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface DestinationFieldProps {
	account: StatementPreviewAccount;
	destination: Destination;
	/** The accounts it can go to: the member's, still open. */
	accounts: Account[];
	currency: string;
	errors: { name?: string; owed?: string };
	disabled?: boolean;
	onChange: (destination: Destination) => void;
}

/**
 * Where an account of the file goes: one of the member's accounts, a new
 * one made from the statement (its opening balance from the file, or from
 * what it owes today), or nowhere.
 */
export function DestinationField({
	account,
	destination,
	accounts,
	currency,
	errors,
	disabled,
	onChange,
}: DestinationFieldProps) {
	const locale = getLocale();
	const value =
		destination.kind === "account" ? destination.accountId : destination.kind;
	const options = [
		...accounts.map((each) => ({ value: each.id, label: each.name })),
		{ value: "new", label: m.import_destination_new() },
		{ value: "skip", label: m.import_destination_skip() },
	];
	const choose = (next: string) => {
		if (next === "new") {
			onChange({
				kind: "new",
				name: statementAccountName(account).slice(0, 60),
				type: account.type,
				owed: "",
			});
		} else if (next === "skip") {
			onChange({ kind: "skip" });
		} else {
			onChange({ kind: "account", accountId: next });
		}
	};

	return (
		<div className="grid gap-3">
			<SelectField
				label={m.import_destination_label()}
				value={value}
				options={options}
				onChange={choose}
				tone="default"
				disabled={disabled}
			/>
			{account.recognized && destination.kind === "account" && (
				<p className="text-muted-foreground text-sm">
					{m.import_destination_recognized()}
				</p>
			)}
			{account.accountId && !account.writable && (
				<p className="text-muted-foreground text-sm">
					{m.import_destination_not_holder()}
				</p>
			)}
			{destination.kind === "new" && (
				<div className="grid gap-3 rounded-md border border-border p-3">
					<TextField
						label={m.account_name_label()}
						value={destination.name}
						maxLength={60}
						error={errors.name}
						onChange={(event) =>
							onChange({ ...destination, name: event.currentTarget.value })
						}
					/>
					<SelectField<AccountType>
						label={m.account_type_label()}
						value={destination.type}
						options={accountTypeOptions()}
						onChange={(type) => onChange({ ...destination, type })}
						tone="default"
					/>
					{account.openingBalance === null ? (
						<TextField
							label={
								ACCOUNT_DEBT_TYPES.includes(destination.type)
									? m.import_destination_owed_label()
									: m.import_destination_balance_label()
							}
							inputMode="decimal"
							value={destination.owed}
							error={errors.owed}
							onChange={(event) =>
								onChange({ ...destination, owed: event.currentTarget.value })
							}
						/>
					) : (
						<p className="text-sm">
							{m.import_destination_opening({
								amount: formatAmount(account.openingBalance, currency, locale),
							})}
						</p>
					)}
				</div>
			)}
		</div>
	);
}
