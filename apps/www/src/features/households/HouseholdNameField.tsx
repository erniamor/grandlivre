import { type Household, householdNameSchema } from "@repo/schemas";
import { PencilIcon } from "lucide-react";
import { useState } from "react";
import { IconButton } from "@/components/IconButton";
import { InlineEditForm } from "@/components/InlineEditForm";
import { useUpdateHousehold } from "@/features/households/use-update-household";
import { validateField } from "@/lib/validate-field";
import { m } from "@/paraglide/messages";

interface HouseholdNameFieldProps {
	household: Household;
}

/** The household's name, which its owners can change in place. */
export function HouseholdNameField({ household }: HouseholdNameFieldProps) {
	const [editing, setEditing] = useState(false);
	const update = useUpdateHousehold(household);

	if (editing) {
		return (
			<InlineEditForm
				label={m.household_name_label()}
				defaultValue={household.name}
				onCancel={() => setEditing(false)}
				onSave={(value) => {
					const name = validateField(householdNameSchema, value);
					if (!name.ok) {
						return name.error;
					}
					if (name.value !== household.name) {
						update.mutate({ name: name.value });
					}
					setEditing(false);
					return undefined;
				}}
			/>
		);
	}

	return (
		<div className="flex items-center gap-2">
			<dl className="grid flex-1 gap-1">
				<dt className="font-medium text-sm">{m.household_name_label()}</dt>
				<dd className="break-words text-muted-foreground">
					{/* The new name shows while it is being saved */}
					{update.isPending
						? (update.variables.name ?? household.name)
						: household.name}
				</dd>
			</dl>
			{household.role === "owner" && (
				<IconButton
					label={m.household_rename_button()}
					tooltip={m.rename_tooltip()}
					icon={PencilIcon}
					onClick={() => setEditing(true)}
				/>
			)}
		</div>
	);
}
