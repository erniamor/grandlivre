import type { Household } from "@repo/schemas";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PeriodPicker } from "@/features/reports/PeriodPicker";
import type { Period } from "@/features/reports/period";
import { ReportSectionView } from "@/features/reports/ReportSectionView";
import { ReportSummary } from "@/features/reports/ReportSummary";
import { ReportTrend } from "@/features/reports/ReportTrend";
import { buildReport } from "@/features/reports/report-tree";
import { tagReportQueryOptions } from "@/features/reports/reports-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface ReportsPageProps {
	household: Household;
	period: Period;
	onPeriodChange: (period: Period) => void;
}

/** What the household earned and spent over a period, tag by tag. */
export function ReportsPage({
	household,
	period,
	onPeriodChange,
}: ReportsPageProps) {
	const { data: report } = useSuspenseQuery(
		tagReportQueryOptions(household.id, period),
	);
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const view = buildReport(report, tags, getLocale());
	const { currency } = household;

	return (
		<section className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
			<header className="grid gap-2">
				<h1 className="font-heading font-semibold text-2xl">
					{m.reports_title()}
				</h1>
				<p className="text-muted-foreground">{m.reports_intro()}</p>
			</header>
			{/* A new period starts with a fresh picker: the key follows it */}
			<PeriodPicker
				key={`${period.from}/${period.to}`}
				period={period}
				onChange={onPeriodChange}
			/>
			{view.isEmpty ? (
				<p className="text-muted-foreground">{m.report_empty()}</p>
			) : (
				<>
					<ReportSummary view={view} currency={currency} />
					<ReportTrend household={household} period={period} tags={tags} />
					<ReportSectionView
						title={m.report_expenses_title()}
						section={view.expenses}
						currency={currency}
						period={period}
						emptyText={m.report_no_expense()}
					/>
					<ReportSectionView
						title={m.report_incomes_title()}
						section={view.incomes}
						currency={currency}
						period={period}
						emptyText={m.report_no_income()}
					/>
				</>
			)}
			<p className="text-muted-foreground text-sm">
				{m.report_accounts_note()}
			</p>
		</section>
	);
}
