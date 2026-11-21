import { Checkbox, Label } from "@repo/ui";
import { useId } from "react";
import { m } from "@/paraglide/messages";

interface UndeterminedFieldProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
}

/**
 * Sets a transaction without a tag aside as undetermined: it can't be told
 * for now, and leaves the ones to categorize. Not a tag.
 */
export function UndeterminedField({
	checked,
	onChange,
}: UndeterminedFieldProps) {
	const id = useId();

	return (
		<div className="flex items-start gap-3 rounded-lg border border-border p-4">
			<Checkbox
				id={id}
				checked={checked}
				onCheckedChange={(value) => onChange(value === true)}
			/>
			<div className="grid gap-1">
				<Label htmlFor={id}>{m.transaction_undetermined_label()}</Label>
				<p className="text-muted-foreground text-sm">
					{m.transaction_undetermined_hint()}
				</p>
			</div>
		</div>
	);
}
