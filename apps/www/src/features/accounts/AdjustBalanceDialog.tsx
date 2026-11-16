import type { Account, AdjustAccount, Household, Tag } from "@repo/schemas";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	toast,
} from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { ScaleIcon } from "lucide-react";
import { useState } from "react";
import { FormAlert } from "@/components/FormAlert";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { isDebtType } from "@/features/accounts/account-form";
import {
	type AdjustFormState,
	adjustmentGap,
	toAdjustInput,
	typedBalance,
} from "@/features/accounts/adjust-form";
import { buildTagTree, flattenTagTree } from "@/features/tags/tag-tree";
import { useLocalToday } from "@/features/transactions/use-local-today";
import { useTransactionChange } from "@/features/transactions/use-transaction-change";
import { getApi } from "@/lib/api";
import { errorMessage, formErrors } from "@/lib/error-messages";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface AdjustBalanceDialogProps {
	household: Household;
	account: Account;
	tags: Tag[];
}

/**
 * Brings an account to what it really holds: the cash counted in a wallet,
 * a bank's balance. The gap is shown as it is typed, then recorded as an
 * adjustment.
 */
export function AdjustBalanceDialog({
	household,
	account,
	tags,
}: AdjustBalanceDialogProps) {
	const locale = getLocale();
	const { currency } = household;
	const today = useLocalToday();
	const refresh = useTransactionChange(household.id);
	const [open, setOpen] = useState(false);
	const [state, setState] = useState<AdjustFormState>({
		balance: "",
		date: "",
		tagId: "",
	});
	const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
	const adjust = useMutation({
		mutationFn: (input: AdjustAccount) =>
			getApi().accounts.adjust(household.id, account.id, input),
		onSuccess: async ({ adjustment }) => {
			setOpen(false);
			toast.success(
				adjustment
					? m.toast_account_adjusted()
					: m.toast_account_already_right(),
			);
			await refresh();
		},
	});
	const apiErrors = adjust.error
		? formErrors(adjust.error)
		: { fields: {} as Record<string, string>, form: undefined };
	const errors = { ...apiErrors.fields, ...localErrors };
	const current = { ...state, date: state.date || today };
	const change = (fields: Partial<AdjustFormState>) =>
		setState({ ...current, ...fields });
	const isCash = account.type === "cash";
	const debt = isDebtType(account.type);
	const money = (amount: number) => formatAmount(amount, currency, locale);
	const actual = typedBalance(current.balance, account.type, currency, locale);
	const gap = actual === null ? null : adjustmentGap(account.balance, actual);
	const tagOptions = [
		{ value: "", label: m.transaction_uncategorized() },
		...flattenTagTree(buildTagTree(tags, locale)).map(({ tag, path }) => ({
			value: tag.id,
			label: path,
		})),
	];

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button type="button" variant="outline" size="sm">
					<ScaleIcon aria-hidden />
					{isCash ? m.account_count_button() : m.account_adjust_button()}
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{isCash ? m.account_count_title() : m.account_adjust_title()}
					</DialogTitle>
					<DialogDescription>
						{m.account_adjust_expected({
							amount: money(debt ? -account.balance : account.balance),
						})}
					</DialogDescription>
				</DialogHeader>
				<form
					noValidate
					className="grid gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						const result = toAdjustInput(
							current,
							account.type,
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
						adjust.mutate(result.input);
					}}
				>
					<TextField
						label={
							isCash
								? m.account_count_label()
								: debt
									? m.account_adjust_owed_label()
									: m.account_adjust_label()
						}
						inputMode="decimal"
						autoComplete="off"
						value={current.balance}
						onChange={(event) => change({ balance: event.target.value })}
						error={errors.balance}
					/>
					<p aria-live="polite" className="text-sm">
						{gap === null
							? null
							: gap === 0
								? m.account_adjust_gap_none()
								: gap < 0
									? isCash
										? m.account_adjust_gap_cash({ amount: money(-gap) })
										: m.account_adjust_gap_less({ amount: money(-gap) })
									: m.account_adjust_gap_more({ amount: money(gap) })}
					</p>
					<TextField
						label={m.transaction_date_label()}
						type="date"
						value={current.date}
						onChange={(event) => change({ date: event.target.value })}
						error={errors.date}
					/>
					<div className="grid gap-2">
						<SelectField
							label={m.account_adjust_tag_label()}
							value={current.tagId}
							options={tagOptions}
							onChange={(tagId) => change({ tagId })}
							tone="default"
							className="grid items-stretch font-medium"
						/>
						<FormAlert message={errors.tagId} />
					</div>
					<FormAlert message={apiErrors.form} />
					<Button type="submit" disabled={adjust.isPending}>
						{m.account_adjust_submit()}
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}
