import { cn } from "@repo/ui";
import type { ReportView } from "@/features/reports/report-tree";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface ReportSummaryProps {
	view: ReportView;
	currency: string;
}

/** The period in three figures: what came in, what went out, what is left. */
export function ReportSummary({ view, currency }: ReportSummaryProps) {
	const locale = getLocale();
	const figures = [
		{
			label: m.report_incomes_title(),
			amount: view.incomes.total,
			signed: false,
		},
		{
			label: m.report_expenses_title(),
			amount: view.expenses.total,
			signed: false,
		},
		{ label: m.report_balance_title(), amount: view.balance, signed: true },
	];

	return (
		<dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
			{figures.map(({ label, amount, signed }) => (
				<div
					key={label}
					className="grid gap-1 rounded-lg border border-border bg-card p-4 text-card-foreground"
				>
					<dt className="text-muted-foreground text-sm">{label}</dt>
					<dd
						className={cn(
							"whitespace-nowrap font-heading font-semibold text-2xl tabular-nums",
							signed && amount > 0 && "text-primary",
							signed && amount < 0 && "text-destructive",
						)}
					>
						{formatAmount(amount, currency, locale, { signed })}
					</dd>
				</div>
			))}
		</dl>
	);
}
