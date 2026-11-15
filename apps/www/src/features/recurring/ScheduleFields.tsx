import { RECURRENCE_UNITS, type RecurrenceUnit } from "@repo/schemas";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import type { ScheduleFormState } from "@/features/recurring/recurring-form";
import { m } from "@/paraglide/messages";

interface ScheduleFieldsProps {
	value: ScheduleFormState;
	onChange: (fields: Partial<ScheduleFormState>) => void;
	/** Messages by field, named as the API names them ("schedule.startDate"). */
	errors: Record<string, string>;
}

const unitLabels: Record<RecurrenceUnit, () => string> = {
	week: m.schedule_unit_week,
	month: m.schedule_unit_month,
	year: m.schedule_unit_year,
};

/** When a recurring transaction comes back: every N weeks, months or years, from a day. */
export function ScheduleFields({
	value,
	onChange,
	errors,
}: ScheduleFieldsProps) {
	return (
		<fieldset className="grid gap-4">
			<legend className="mb-2 font-medium">{m.schedule_legend()}</legend>
			<div className="grid grid-cols-[6rem_1fr] items-start gap-3">
				<TextField
					label={m.schedule_interval_label()}
					inputMode="numeric"
					autoComplete="off"
					value={value.interval}
					onChange={(event) => onChange({ interval: event.target.value })}
					error={errors["schedule.interval"]}
				/>
				<SelectField
					label={m.schedule_unit_label()}
					value={value.unit}
					options={RECURRENCE_UNITS.map((unit) => ({
						value: unit,
						label: unitLabels[unit](),
					}))}
					onChange={(unit) => onChange({ unit })}
					tone="default"
					className="grid items-stretch font-medium"
				/>
			</div>
			<TextField
				label={m.schedule_start_label()}
				type="date"
				value={value.startDate}
				onChange={(event) => onChange({ startDate: event.target.value })}
				required
				error={errors["schedule.startDate"]}
			/>
			<TextField
				label={m.schedule_end_label()}
				type="date"
				value={value.endDate}
				onChange={(event) => onChange({ endDate: event.target.value })}
				error={errors["schedule.endDate"]}
			/>
		</fieldset>
	);
}
