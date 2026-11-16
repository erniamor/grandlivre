import type { Budget, BudgetStatus, SetBudget, Tag } from "@repo/schemas";
import { Button } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { FormAlert } from "@/components/FormAlert";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { BudgetPeriodField } from "@/features/budgets/BudgetPeriodField";
import { BudgetSuggestion } from "@/features/budgets/BudgetSuggestion";
import {
	type BudgetFormState,
	budgetFormState,
	toSetBudgetInput,
} from "@/features/budgets/budget-form";
import { buildTagTree, flattenTagTree } from "@/features/tags/tag-tree";
import { errorMessage, formErrors } from "@/lib/error-messages";
import { formatAmountInput } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface BudgetFormProps {
	householdId: string;
	currency: string;
	tags: Tag[];
	/** The month shown: the budget applies from it unless changed. */
	month: string;
	/** The tag whose budget is set; without it, the user chooses one. */
	tagId?: string;
	/** The budget in force that month, to change. */
	budget?: BudgetStatus;
	submitLabel: string;
	save: (tagId: string, input: SetBudget) => Promise<Budget>;
	onSaved: (budget: Budget) => void | Promise<void>;
}

/** Sets the budget of a tag, monthly or yearly, from a month on. */
export function BudgetForm({
	householdId,
	currency,
	tags,
	month,
	tagId,
	budget,
	submitLabel,
	save,
	onSaved,
}: BudgetFormProps) {
	const locale = getLocale();
	const [state, setState] = useState<BudgetFormState>(() =>
		budgetFormState(month, currency, locale, { tagId, budget }),
	);
	const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
	const mutation = useMutation({
		mutationFn: ({ tag, input }: { tag: string; input: SetBudget }) =>
			save(tag, input),
		onSuccess: onSaved,
	});
	const apiErrors = mutation.error
		? formErrors(mutation.error)
		: { fields: {} as Record<string, string>, form: undefined };
	const errors = { ...apiErrors.fields, ...localErrors };
	const change = (fields: Partial<BudgetFormState>) =>
		setState({ ...state, ...fields });
	const tagOptions = [
		{ value: "", label: m.budget_choose_tag() },
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
				const result = toSetBudgetInput(state, currency, locale);
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
				mutation.mutate({ tag: result.tagId, input: result.input });
			}}
		>
			{tagId === undefined && (
				<div className="grid gap-2">
					<SelectField
						label={m.budget_tag_label()}
						value={state.tagId}
						options={tagOptions}
						onChange={(value) => change({ tagId: value })}
						tone="default"
						className="grid items-stretch font-medium"
					/>
					<p className="text-muted-foreground text-sm">{m.budget_tag_hint()}</p>
					<FormAlert message={errors.tagId} />
				</div>
			)}
			<BudgetPeriodField
				value={state.period}
				onChange={(period) => change({ period })}
			/>
			<div className="grid gap-2">
				<TextField
					label={
						state.period === "month"
							? m.budget_amount_month_label()
							: m.budget_amount_year_label()
					}
					inputMode="decimal"
					autoComplete="off"
					value={state.amount}
					onChange={(event) => change({ amount: event.target.value })}
					error={errors.amount}
				/>
				{state.tagId && (
					<BudgetSuggestion
						householdId={householdId}
						tagId={state.tagId}
						month={state.from}
						period={state.period}
						currency={currency}
						onUse={(amount) =>
							change({ amount: formatAmountInput(amount, currency, locale) })
						}
					/>
				)}
			</div>
			<div className="grid gap-2">
				<TextField
					label={m.budget_from_label()}
					type="month"
					value={state.from}
					onChange={(event) => change({ from: event.target.value })}
					error={errors.from}
				/>
				<p className="text-muted-foreground text-sm">{m.budget_from_hint()}</p>
			</div>
			<FormAlert message={apiErrors.form} />
			<Button type="submit" disabled={mutation.isPending}>
				{submitLabel}
			</Button>
		</form>
	);
}
