import type { Household } from "@repo/schemas";
import { cn } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { cardClass } from "@/components/card-styles";
import { sensitiveClass } from "@/components/sensitive";
import {
	type BreakdownRow,
	expenseBreakdown,
} from "@/features/dashboard/expense-breakdown";
import { monthToDate } from "@/features/dashboard/key-figures";
import { buildReport } from "@/features/reports/report-tree";
import { tagReportQueryOptions } from "@/features/reports/reports-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { todayIn } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface ExpenseBreakdownCardProps {
	household: Household;
}

function rowName(row: BreakdownRow): string {
	switch (row.kind) {
		case "uncategorized":
			return m.transaction_uncategorized();
		case "others":
			return m.dashboard_breakdown_others();
		default:
			return row.name;
	}
}

/**
 * This month's expenses by tag at the top of the tree, the biggest first,
 * each with its amount and share written beside a bar: a list read as is,
 * no chart library needed.
 */
export function ExpenseBreakdownCard({ household }: ExpenseBreakdownCardProps) {
	const locale = getLocale();
	const titleId = useId();
	const { current } = monthToDate(todayIn(household.timeZone));
	const { data: report } = useSuspenseQuery(
		tagReportQueryOptions(household.id, current),
	);
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const rows = expenseBreakdown(buildReport(report, tags, locale));
	// The bars on the biggest one's scale
	const biggest = rows.reduce((max, row) => Math.max(max, row.share), 0);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});

	return (
		<section aria-labelledby={titleId} className={cn("grid gap-4", cardClass)}>
			<h2 id={titleId} className="font-heading font-semibold text-lg">
				{m.dashboard_breakdown_title()}
			</h2>
			{rows.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					{m.dashboard_breakdown_empty()}
				</p>
			) : (
				<ul className="grid gap-3">
					{rows.map((row) => (
						<li key={`${row.kind}-${row.tagId}`} className="grid gap-1">
							<div className="flex items-baseline justify-between gap-3 text-sm">
								<span className="min-w-0 truncate">{rowName(row)}</span>
								<span
									className={cn(
										"whitespace-nowrap tabular-nums",
										sensitiveClass,
									)}
								>
									{formatAmount(row.amount, household.currency, locale)}
									<span className="ml-2 text-muted-foreground">
										{percent.format(row.share)}
									</span>
								</span>
							</div>
							<div
								aria-hidden
								className={cn(
									"h-2 overflow-hidden rounded-full bg-muted",
									sensitiveClass,
								)}
							>
								<div
									className="h-full rounded-full bg-primary"
									style={{ width: `${(row.share / biggest) * 100}%` }}
								/>
							</div>
						</li>
					))}
				</ul>
			)}
			<Link
				to="/reports"
				className="justify-self-start rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
			>
				{m.dashboard_reports_link()}
			</Link>
		</section>
	);
}
