import type { Account, CreateSettlement, Settlement } from "@repo/schemas";
import { Button, Checkbox, Label } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { FormAlert } from "@/components/FormAlert";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import {
	accountsHeldBy,
	type SettleFormState,
	toSettlementInput,
} from "@/features/sharing/settle-form";
import { getApi } from "@/lib/api";
import { errorMessage, formErrors } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface SettleFormProps {
	householdId: string;
	currency: string;
	meId: string;
	members: { userId: string; name: string }[];
	accounts: Account[];
	initial: SettleFormState;
	onSettled: (settlement: Settlement) => void | Promise<void>;
}

/**
 * Records that a member paid another: by the one who paid, who can also
 * record it as a transfer between their accounts, or by the one paid.
 */
export function SettleForm({
	householdId,
	currency,
	meId,
	members,
	accounts,
	initial,
	onSettled,
}: SettleFormProps) {
	const locale = getLocale();
	const transferId = useId();
	const [state, setState] = useState(initial);
	const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
	const settle = useMutation({
		mutationFn: (input: CreateSettlement) =>
			getApi().sharing.settle(householdId, input),
		onSuccess: onSettled,
	});
	const apiErrors = settle.error
		? formErrors(settle.error)
		: { fields: {} as Record<string, string>, form: undefined };
	const errors = { ...apiErrors.fields, ...localErrors };
	const change = (fields: Partial<SettleFormState>) =>
		setState({ ...state, ...fields });
	const memberOptions = members.map(({ userId, name }) => ({
		value: userId,
		label: name,
	}));
	// The transfer leaves an account the user holds: they are the one paying
	const canTransfer = state.fromUserId === meId;
	const accountOptions = (userId: string) => [
		{ value: "", label: m.transaction_choose_account() },
		...accountsHeldBy(accounts, userId).map((account) => ({
			value: account.id,
			label: account.name,
		})),
	];

	return (
		<form
			noValidate
			className="grid gap-6"
			onSubmit={(event) => {
				event.preventDefault();
				const result = toSettlementInput(
					{ ...state, transfer: canTransfer && state.transfer },
					currency,
					locale,
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
				settle.mutate(result.input);
			}}
		>
			<SelectField
				label={m.settle_from_label()}
				value={state.fromUserId}
				options={memberOptions}
				onChange={(fromUserId) => change({ fromUserId, fromAccountId: "" })}
				tone="default"
				className="grid items-stretch font-medium"
			/>
			<div className="grid gap-2">
				<SelectField
					label={m.settle_to_label()}
					value={state.toUserId}
					options={memberOptions}
					onChange={(toUserId) => change({ toUserId, toAccountId: "" })}
					tone="default"
					className="grid items-stretch font-medium"
				/>
				<FormAlert message={errors.toUserId} />
			</div>
			<TextField
				label={m.settle_amount_label()}
				inputMode="decimal"
				autoComplete="off"
				value={state.amount}
				onChange={(event) => change({ amount: event.target.value })}
				error={errors.amount}
			/>
			<TextField
				label={m.transaction_date_label()}
				type="date"
				value={state.date}
				onChange={(event) => change({ date: event.target.value })}
				error={errors.date}
			/>
			<TextField
				label={m.transaction_note_label()}
				autoComplete="off"
				value={state.note}
				onChange={(event) => change({ note: event.target.value })}
				error={errors.note}
			/>
			{canTransfer && (
				<fieldset className="grid gap-4 rounded-lg border border-border p-4">
					<legend className="sr-only">{m.settle_transfer_label()}</legend>
					<div className="flex items-start gap-3">
						<Checkbox
							id={transferId}
							checked={state.transfer}
							onCheckedChange={(checked) =>
								change({ transfer: checked === true })
							}
						/>
						<div className="grid gap-1">
							<Label htmlFor={transferId}>{m.settle_transfer_label()}</Label>
							<p className="text-muted-foreground text-sm">
								{m.settle_transfer_hint()}
							</p>
						</div>
					</div>
					{state.transfer && (
						<>
							<div className="grid gap-2">
								<SelectField
									label={m.transaction_from_account_label()}
									value={state.fromAccountId}
									options={accountOptions(state.fromUserId)}
									onChange={(fromAccountId) => change({ fromAccountId })}
									tone="default"
									className="grid items-stretch font-medium"
								/>
								<FormAlert message={errors["transfer.fromAccountId"]} />
							</div>
							<div className="grid gap-2">
								<SelectField
									label={m.transaction_to_account_label()}
									value={state.toAccountId}
									options={accountOptions(state.toUserId)}
									onChange={(toAccountId) => change({ toAccountId })}
									tone="default"
									className="grid items-stretch font-medium"
								/>
								<FormAlert message={errors["transfer.toAccountId"]} />
							</div>
						</>
					)}
				</fieldset>
			)}
			<FormAlert message={apiErrors.form} />
			<Button type="submit" disabled={settle.isPending}>
				{m.settle_submit()}
			</Button>
		</form>
	);
}
