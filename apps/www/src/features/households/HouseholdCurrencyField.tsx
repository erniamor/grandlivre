import type { Household } from "@repo/schemas";
import { SelectField } from "@/components/SelectField";
import { currencyOptions } from "@/features/households/currency-options";
import { useUpdateHousehold } from "@/features/households/use-update-household";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface HouseholdCurrencyFieldProps {
	household: Household;
}

/** The household's currency, which its owners can change. */
export function HouseholdCurrencyField({
	household,
}: HouseholdCurrencyFieldProps) {
	const update = useUpdateHousehold(household);
	const options = currencyOptions(getLocale());
	const currency = update.isPending
		? (update.variables.currency ?? household.currency)
		: household.currency;

	if (household.role !== "owner") {
		return (
			<dl className="grid gap-1">
				<dt className="font-medium text-sm">{m.household_currency_label()}</dt>
				<dd className="text-muted-foreground">
					{options.find((option) => option.value === currency)?.label}
				</dd>
			</dl>
		);
	}

	return (
		<div className="grid gap-2">
			<SelectField
				label={m.household_currency_label()}
				value={currency}
				options={options}
				onChange={(value) => update.mutate({ currency: value })}
				disabled={update.isPending}
				tone="default"
				className="grid items-stretch font-medium"
			/>
			<p className="text-muted-foreground text-sm">
				{m.household_currency_hint()}
			</p>
		</div>
	);
}
