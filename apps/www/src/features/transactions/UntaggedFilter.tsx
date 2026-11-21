import { Button } from "@repo/ui";
import type { Untagged } from "@/features/transactions/transaction-filters";
import { m } from "@/paraglide/messages";

interface UntaggedFilterProps {
	value?: Untagged;
	onChange: (untagged: Untagged | undefined) => void;
}

const choices: { untagged?: Untagged; label: () => string }[] = [
	{ label: m.transactions_untagged_all },
	{ untagged: "to-define", label: m.transactions_untagged_to_define },
	{ untagged: "undetermined", label: m.transactions_untagged_undetermined },
];

/**
 * The transactions without a tag: those still to categorize, or those set
 * aside as undetermined; or all of them, tagged or not.
 */
export function UntaggedFilter({ value, onChange }: UntaggedFilterProps) {
	return (
		<fieldset className="grid gap-2">
			<legend className="mb-2 font-medium text-sm">
				{m.transactions_untagged_filter_label()}
			</legend>
			<div className="flex flex-wrap gap-1">
				{choices.map(({ untagged, label }) => (
					<Button
						key={untagged ?? "all"}
						type="button"
						size="sm"
						variant={untagged === value ? "default" : "outline"}
						aria-pressed={untagged === value}
						onClick={() => onChange(untagged)}
					>
						{label()}
					</Button>
				))}
			</div>
		</fieldset>
	);
}
