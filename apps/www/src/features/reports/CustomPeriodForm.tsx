import { Button } from "@repo/ui";
import { useState } from "react";
import { TextField } from "@/components/TextField";
import { isPeriod, type Period } from "@/features/reports/period";
import { m } from "@/paraglide/messages";

interface CustomPeriodFormProps {
	period: Period;
	onChange: (period: Period) => void;
}

/** Chooses the first and last days of a period. */
export function CustomPeriodForm({ period, onChange }: CustomPeriodFormProps) {
	const [from, setFrom] = useState(period.from);
	const [to, setTo] = useState(period.to);
	const [error, setError] = useState<string>();

	return (
		<form
			noValidate
			className="flex flex-wrap items-end gap-3"
			onSubmit={(event) => {
				event.preventDefault();
				if (!from || !to || !isPeriod(from, to)) {
					setError(m.error_report_period_invalid());
					return;
				}
				setError(undefined);
				onChange({ from, to });
			}}
		>
			<TextField
				label={m.period_from_label()}
				type="date"
				value={from}
				onChange={(event) => setFrom(event.target.value)}
				required
			/>
			<TextField
				label={m.period_to_label()}
				type="date"
				value={to}
				onChange={(event) => setTo(event.target.value)}
				required
				error={error}
			/>
			<Button type="submit">{m.period_apply_button()}</Button>
		</form>
	);
}
