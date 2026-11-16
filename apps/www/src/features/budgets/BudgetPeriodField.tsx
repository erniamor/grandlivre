import { BUDGET_PERIODS, type BudgetPeriod } from "@repo/schemas";
import { useId } from "react";
import { HelpHint } from "@/features/help/HelpHint";
import { m } from "@/paraglide/messages";

interface BudgetPeriodFieldProps {
	value: BudgetPeriod;
	onChange: (period: BudgetPeriod) => void;
}

const labels: Record<BudgetPeriod, () => string> = {
	month: m.budget_period_month,
	year: m.budget_period_year,
};

const hints: Record<BudgetPeriod, () => string> = {
	month: m.budget_period_month_hint,
	year: m.budget_period_year_hint,
};

/** Whether a budget covers each month, or each year. */
export function BudgetPeriodField({ value, onChange }: BudgetPeriodFieldProps) {
	const name = useId();

	return (
		<fieldset className="grid gap-2">
			<legend className="mb-2 flex items-center gap-1 font-medium">
				{m.budget_period_label()}
				<HelpHint topic="budgetPeriod" />
			</legend>
			{BUDGET_PERIODS.map((period) => (
				<label
					key={period}
					className="flex cursor-pointer gap-3 rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-offset-2"
				>
					<input
						type="radio"
						name={name}
						value={period}
						checked={value === period}
						onChange={() => onChange(period)}
						className="mt-1 accent-primary"
					/>
					<span className="grid gap-0.5">
						<span className="font-medium">{labels[period]()}</span>
						<span className="text-muted-foreground text-sm">
							{hints[period]()}
						</span>
					</span>
				</label>
			))}
		</fieldset>
	);
}
