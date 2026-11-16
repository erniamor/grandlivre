import type { Household } from "@repo/schemas";
import { Checkbox, Label } from "@repo/ui";
import { useId } from "react";
import { useUpdateHousehold } from "@/features/households/use-update-household";
import { m } from "@/paraglide/messages";

interface HouseholdSharingFieldProps {
	household: Household;
}

/**
 * Whether the members settle the expenses they share: off by default, for
 * the households that pool everything. Its owners turn it on or off.
 */
export function HouseholdSharingField({
	household,
}: HouseholdSharingFieldProps) {
	const id = useId();
	const update = useUpdateHousehold(household);
	const enabled = update.isPending
		? (update.variables.expenseSharing ?? household.expenseSharing)
		: household.expenseSharing;

	if (household.role !== "owner") {
		return (
			<dl className="grid gap-1">
				<dt className="font-medium text-sm">{m.household_sharing_label()}</dt>
				<dd className="text-muted-foreground">
					{enabled ? m.household_sharing_on() : m.household_sharing_off()}
				</dd>
			</dl>
		);
	}

	return (
		<div className="flex items-start gap-3">
			<Checkbox
				id={id}
				checked={enabled}
				disabled={update.isPending}
				onCheckedChange={(checked) =>
					update.mutate({ expenseSharing: checked === true })
				}
			/>
			<div className="grid gap-1">
				<Label htmlFor={id}>{m.household_sharing_label()}</Label>
				<p className="text-muted-foreground text-sm">
					{m.household_sharing_hint()}
				</p>
			</div>
		</div>
	);
}
