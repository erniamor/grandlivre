import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { IconButton } from "@/components/IconButton";
import { CustomPeriodForm } from "@/features/reports/CustomPeriodForm";
import { PeriodKindField } from "@/features/reports/PeriodKindField";
import {
	monthOf,
	type Period,
	type PeriodKind,
	periodKind,
	periodLabel,
	shiftPeriod,
	yearOf,
} from "@/features/reports/period";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface PeriodPickerProps {
	period: Period;
	onChange: (period: Period) => void;
}

/** Chooses the period of a report: a month, a year, or other days. */
export function PeriodPicker({ period, onChange }: PeriodPickerProps) {
	// Other days can happen to make a month: what the user chose wins
	const [kind, setKind] = useState<PeriodKind>(() => periodKind(period));

	return (
		<div className="grid gap-3">
			<PeriodKindField
				value={kind}
				onChange={(next) => {
					setKind(next);
					if (next === "month") {
						onChange(monthOf(period.from));
					} else if (next === "year") {
						onChange(yearOf(period.from));
					}
				}}
			/>
			{kind === "custom" ? (
				<CustomPeriodForm period={period} onChange={onChange} />
			) : (
				<div className="flex items-center justify-between gap-2">
					<IconButton
						label={m.period_previous()}
						icon={ChevronLeftIcon}
						onClick={() => onChange(shiftPeriod(period, -1))}
					/>
					<p className="font-medium first-letter:uppercase" aria-live="polite">
						{periodLabel(period, getLocale())}
					</p>
					<IconButton
						label={m.period_next()}
						icon={ChevronRightIcon}
						onClick={() => onChange(shiftPeriod(period, 1))}
					/>
				</div>
			)}
		</div>
	);
}
