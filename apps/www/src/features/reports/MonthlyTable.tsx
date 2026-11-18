import { cn } from "@repo/ui";
import { sensitiveClass } from "@/components/sensitive";
import { monthLabel } from "@/features/reports/month-label";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface MonthlyTableProps {
	months: { month: string; expense: number; income: number }[];
	currency: string;
}

/** The figures of the charts, month by month: readable without the charts. */
export function MonthlyTable({ months, currency }: MonthlyTableProps) {
	const locale = getLocale();
	const amount = (value: number) => formatAmount(value, currency, locale);

	return (
		<details className="text-sm">
			<summary className="cursor-pointer rounded-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2">
				{m.report_trend_table_toggle()}
			</summary>
			<table className="mt-2 w-full">
				<thead>
					<tr className="border-border border-b text-left text-muted-foreground">
						<th scope="col" className="py-1 font-medium">
							{m.report_trend_month()}
						</th>
						<th scope="col" className="py-1 text-right font-medium">
							{m.report_expenses_title()}
						</th>
						<th scope="col" className="py-1 text-right font-medium">
							{m.report_incomes_title()}
						</th>
					</tr>
				</thead>
				<tbody>
					{months.map(({ month, expense, income }) => (
						<tr key={month} className="border-border border-b last:border-0">
							<th
								scope="row"
								className="py-1 text-left font-normal first-letter:uppercase"
							>
								{monthLabel(month, locale, "long")}
							</th>
							<td
								className={cn("py-1 text-right tabular-nums", sensitiveClass)}
							>
								{amount(expense)}
							</td>
							<td
								className={cn("py-1 text-right tabular-nums", sensitiveClass)}
							>
								{amount(income)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</details>
	);
}
