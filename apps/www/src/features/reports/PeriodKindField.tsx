import { useId } from "react";
import type { PeriodKind } from "@/features/reports/period";
import { m } from "@/paraglide/messages";

interface PeriodKindFieldProps {
	value: PeriodKind;
	onChange: (kind: PeriodKind) => void;
}

const kinds: { kind: PeriodKind; label: () => string }[] = [
	{ kind: "month", label: m.period_kind_month },
	{ kind: "year", label: m.period_kind_year },
	{ kind: "custom", label: m.period_kind_custom },
];

/** Chooses between a month, a year and other days: radio buttons side by side. */
export function PeriodKindField({ value, onChange }: PeriodKindFieldProps) {
	const name = useId();

	return (
		<fieldset className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted p-1">
			<legend className="sr-only">{m.report_period_label()}</legend>
			{kinds.map(({ kind, label }) => (
				<label key={kind} className="relative grid">
					<input
						type="radio"
						name={name}
						value={kind}
						checked={value === kind}
						onChange={() => onChange(kind)}
						className="peer absolute inset-0 cursor-pointer opacity-0"
					/>
					<span className="rounded-md px-3 py-1.5 text-center font-medium text-muted-foreground text-sm peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-focus-visible:outline-offset-2">
						{label()}
					</span>
				</label>
			))}
		</fieldset>
	);
}
