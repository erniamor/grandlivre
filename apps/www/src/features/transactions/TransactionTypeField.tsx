import { TRANSACTION_TYPES, type TransactionType } from "@repo/schemas";
import { useId } from "react";
import { m } from "@/paraglide/messages";

interface TransactionTypeFieldProps {
	value: TransactionType;
	onChange: (type: TransactionType) => void;
}

const labels: Record<TransactionType, () => string> = {
	expense: m.transaction_type_expense,
	income: m.transaction_type_income,
	transfer: m.transaction_type_transfer,
};

/** Chooses between an expense, an income and a transfer: radio buttons side by side. */
export function TransactionTypeField({
	value,
	onChange,
}: TransactionTypeFieldProps) {
	const name = useId();

	return (
		<fieldset className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted p-1">
			<legend className="sr-only">{m.transaction_type_label()}</legend>
			{TRANSACTION_TYPES.map((type) => (
				<label key={type} className="relative grid">
					<input
						type="radio"
						name={name}
						value={type}
						checked={value === type}
						onChange={() => onChange(type)}
						className="peer absolute inset-0 cursor-pointer opacity-0"
					/>
					<span className="rounded-md px-3 py-1.5 text-center font-medium text-muted-foreground text-sm peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-focus-visible:outline-offset-2">
						{labels[type]()}
					</span>
				</label>
			))}
		</fieldset>
	);
}
