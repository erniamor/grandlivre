import type { Household } from "@repo/schemas";
import { SelectField } from "@/components/SelectField";
import { timeZoneOptions } from "@/features/households/time-zone-options";
import { useUpdateHousehold } from "@/features/households/use-update-household";
import { m } from "@/paraglide/messages";

interface HouseholdTimeZoneFieldProps {
	household: Household;
}

/**
 * Where the household lives: its days start there, for its recurring
 * transactions. Its owners can change it.
 */
export function HouseholdTimeZoneField({
	household,
}: HouseholdTimeZoneFieldProps) {
	const update = useUpdateHousehold(household);
	const timeZone = update.isPending
		? (update.variables.timeZone ?? household.timeZone)
		: household.timeZone;
	const options = timeZoneOptions(timeZone);

	if (household.role !== "owner") {
		return (
			<dl className="grid gap-1">
				<dt className="font-medium text-sm">{m.household_time_zone_label()}</dt>
				<dd className="text-muted-foreground">
					{options.find((option) => option.value === timeZone)?.label}
				</dd>
			</dl>
		);
	}

	return (
		<div className="grid gap-2">
			<SelectField
				label={m.household_time_zone_label()}
				value={timeZone}
				options={options}
				onChange={(value) => update.mutate({ timeZone: value })}
				disabled={update.isPending}
				tone="default"
				className="grid items-stretch font-medium"
			/>
			<p className="text-muted-foreground text-sm">
				{m.household_time_zone_hint()}
			</p>
		</div>
	);
}
