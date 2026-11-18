import type { Household } from "@repo/schemas";
import { cn } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { lazy, Suspense, useId } from "react";
import { cardClass } from "@/components/card-styles";
import { monthOf } from "@/features/reports/period";
import { monthTotals } from "@/features/reports/report-tree";
import { monthlyReportQueryOptions } from "@/features/reports/reports-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { todayIn } from "@/lib/dates";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

// The chart library loads apart: the rest of the dashboard doesn't wait for it
const MonthlyBarChart = lazy(() =>
	import("@/features/reports/MonthlyBarChart").then((module) => ({
		default: module.MonthlyBarChart,
	})),
);

/** The height of the chart, kept while it loads: nothing moves when it shows. */
const CHART_HEIGHT = "h-44";

interface MonthlyExpensesCardProps {
	household: Household;
}

/** The household's expenses over the twelve months ending with this one. */
export function MonthlyExpensesCard({ household }: MonthlyExpensesCardProps) {
	const locale = getLocale();
	const titleId = useId();
	const { data: report } = useSuspenseQuery(
		monthlyReportQueryOptions(
			household.id,
			monthOf(todayIn(household.timeZone)),
		),
	);
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const months = report.months.map((month) => ({
		month: month.month,
		amount: monthTotals(month, tags, locale).expense,
	}));
	const max = Math.max(0, ...months.map(({ amount }) => amount));
	const title = m.dashboard_monthly_title();

	return (
		<section aria-labelledby={titleId} className={cn("grid gap-4", cardClass)}>
			<h2 id={titleId} className="font-heading font-semibold text-lg">
				{title}
			</h2>
			{max === 0 ? (
				<p className="text-muted-foreground text-sm">
					{m.dashboard_monthly_empty()}
				</p>
			) : (
				<Suspense
					fallback={
						<div
							aria-hidden
							className={cn(CHART_HEIGHT, "rounded-md bg-muted/50")}
						/>
					}
				>
					<MonthlyBarChart
						title={title}
						hideTitle
						months={months}
						currency={household.currency}
						max={max}
					/>
				</Suspense>
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
