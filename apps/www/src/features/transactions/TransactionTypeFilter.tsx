import type { TransactionType } from "@repo/schemas";
import { Button } from "@repo/ui";
import { m } from "@/paraglide/messages";

interface TransactionTypeFilterProps {
	value?: TransactionType;
	onChange: (type: TransactionType | undefined) => void;
}

const choices: { type?: TransactionType; label: () => string }[] = [
	{ label: m.transactions_type_all },
	{ type: "expense", label: m.transactions_type_expenses },
	{ type: "income", label: m.transactions_type_incomes },
	{ type: "transfer", label: m.transactions_type_transfers },
];

/**
 * Money going out, coming in, or moving between the household's accounts:
 * one at a time, or all.
 */
export function TransactionTypeFilter({
	value,
	onChange,
}: TransactionTypeFilterProps) {
	return (
		<fieldset className="grid gap-2">
			<legend className="mb-2 font-medium text-sm">
				{m.transactions_type_filter_label()}
			</legend>
			<div className="flex flex-wrap gap-1">
				{choices.map(({ type, label }) => (
					<Button
						key={type ?? "all"}
						type="button"
						size="sm"
						variant={type === value ? "default" : "outline"}
						aria-pressed={type === value}
						onClick={() => onChange(type)}
					>
						{label()}
					</Button>
				))}
			</div>
		</fieldset>
	);
}
