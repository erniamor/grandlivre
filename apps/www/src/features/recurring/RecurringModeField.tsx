import type { RecurrenceMode } from "@repo/schemas";
import { useId } from "react";
import { m } from "@/paraglide/messages";

interface RecurringModeFieldProps {
	value: RecurrenceMode;
	onChange: (mode: RecurrenceMode) => void;
}

const labels: Record<RecurrenceMode, () => string> = {
	confirm: m.recurring_mode_confirm,
	automatic: m.recurring_mode_automatic,
};

// The default first: the safer choice for a real balance
const order: RecurrenceMode[] = ["confirm", "automatic"];

const hints: Record<RecurrenceMode, () => string> = {
	confirm: m.recurring_mode_confirm_hint,
	automatic: m.recurring_mode_automatic_hint,
};

/** Whether a recurring transaction is recorded on its own, or waits to be confirmed. */
export function RecurringModeField({
	value,
	onChange,
}: RecurringModeFieldProps) {
	const name = useId();

	return (
		<fieldset className="grid gap-2">
			<legend className="mb-2 font-medium">{m.recurring_mode_label()}</legend>
			{order.map((mode) => (
				<label
					key={mode}
					className="flex cursor-pointer gap-3 rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-offset-2"
				>
					<input
						type="radio"
						name={name}
						value={mode}
						checked={value === mode}
						onChange={() => onChange(mode)}
						className="mt-1 accent-primary"
					/>
					<span className="grid gap-0.5">
						<span className="font-medium">{labels[mode]()}</span>
						<span className="text-muted-foreground text-sm">
							{hints[mode]()}
						</span>
					</span>
				</label>
			))}
		</fieldset>
	);
}
