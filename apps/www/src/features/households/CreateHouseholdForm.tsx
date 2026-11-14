import type { Household, HouseholdCurrency } from "@repo/schemas";
import { Button } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { FormAlert } from "@/components/FormAlert";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import {
	currencyOptions,
	DEFAULT_CURRENCY,
} from "@/features/households/currency-options";
import { getApi } from "@/lib/api";
import { formErrors } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface CreateHouseholdFormProps {
	onCreated: (household: Household) => void | Promise<void>;
}

/** Creates a household, owned by the signed-in user. */
export function CreateHouseholdForm({ onCreated }: CreateHouseholdFormProps) {
	const [currency, setCurrency] = useState<HouseholdCurrency>(DEFAULT_CURRENCY);
	const create = useMutation({
		mutationFn: (name: string) =>
			getApi().households.create({ name, currency }),
		onSuccess: onCreated,
	});
	const errors = create.error ? formErrors(create.error) : { fields: {} };

	return (
		<form
			noValidate
			className="grid gap-4"
			onSubmit={(event) => {
				event.preventDefault();
				create.mutate(
					String(new FormData(event.currentTarget).get("name") ?? ""),
				);
			}}
		>
			<TextField
				label={m.household_name_label()}
				name="name"
				autoComplete="off"
				required
				error={errors.fields.name}
			/>
			<div className="grid gap-2">
				<SelectField
					label={m.household_currency_label()}
					value={currency}
					options={currencyOptions(getLocale())}
					onChange={setCurrency}
					tone="default"
					className="grid items-stretch font-medium"
				/>
				<p className="text-muted-foreground text-sm">
					{m.household_currency_hint()}
				</p>
			</div>
			<FormAlert message={errors.form ?? errors.fields.currency} />
			<Button type="submit" disabled={create.isPending}>
				{m.create_household_button()}
			</Button>
		</form>
	);
}
