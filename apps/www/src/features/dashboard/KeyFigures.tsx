import type { Household } from "@repo/schemas";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { Amount } from "@/features/accounts/Amount";
import { accountsSummaryQueryOptions } from "@/features/accounts/accounts-query";
import { KeyFigureTile } from "@/features/dashboard/KeyFigureTile";
import { keyFigures, monthToDate } from "@/features/dashboard/key-figures";
import { buildReport } from "@/features/reports/report-tree";
import { tagReportQueryOptions } from "@/features/reports/reports-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { formatShortDay, todayIn } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface KeyFiguresProps {
	household: Household;
}

/**
 * Where the household stands, at a glance: its net balance, and this
 * month's expenses (against last month at the same day), incomes and
 * savings, counted as the reports count them.
 */
export function KeyFigures({ household }: KeyFiguresProps) {
	const locale = getLocale();
	const titleId = useId();
	const { currency } = household;
	const periods = monthToDate(todayIn(household.timeZone));
	const { data: summary } = useSuspenseQuery(
		accountsSummaryQueryOptions(household.id),
	);
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const { data: current } = useSuspenseQuery(
		tagReportQueryOptions(household.id, periods.current),
	);
	const { data: previous } = useSuspenseQuery(
		tagReportQueryOptions(household.id, periods.previous),
	);
	const figures = keyFigures(
		buildReport(current, tags, locale),
		buildReport(previous, tags, locale),
	);
	const percent = (ratio: number) =>
		new Intl.NumberFormat(locale, {
			style: "percent",
			maximumFractionDigits: 0,
		}).format(Math.abs(ratio));
	const lastMonthDay = formatShortDay(periods.previous.to, locale);
	const change = figures.expensesChange;

	return (
		<section aria-labelledby={titleId}>
			<h2 id={titleId} className="sr-only">
				{m.dashboard_figures_title()}
			</h2>
			<dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<KeyFigureTile
					label={m.summary_title()}
					value={<Amount amount={summary.balance} currency={currency} />}
					detail={m.dashboard_figure_balance_detail({
						assets: formatAmount(summary.assets, currency, locale),
						liabilities: formatAmount(summary.liabilities, currency, locale),
					})}
					link={
						<Link
							to="/accounts"
							className="rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
						>
							{m.summary_accounts_link()}
						</Link>
					}
				/>
				<KeyFigureTile
					label={m.dashboard_figure_expenses()}
					value={<Amount amount={figures.expenses} currency={currency} />}
					detail={
						change === null
							? m.dashboard_figure_expenses_no_comparison()
							: Math.round(change * 100) === 0
								? m.dashboard_figure_expenses_same({ date: lastMonthDay })
								: (change > 0
										? m.dashboard_figure_expenses_more
										: m.dashboard_figure_expenses_less)({
										percent: percent(change),
										date: lastMonthDay,
									})
					}
				/>
				<KeyFigureTile
					label={m.dashboard_figure_incomes()}
					value={<Amount amount={figures.incomes} currency={currency} />}
					detail={m.dashboard_figure_since({
						date: formatShortDay(periods.current.from, locale),
					})}
				/>
				<KeyFigureTile
					label={m.dashboard_figure_savings()}
					value={<Amount amount={figures.savings} currency={currency} />}
					detail={
						figures.savingsRate === null
							? m.dashboard_figure_savings_no_incomes()
							: m.dashboard_figure_savings_rate({
									percent: `${figures.savingsRate < 0 ? "-" : ""}${percent(figures.savingsRate)}`,
								})
					}
				/>
			</dl>
		</section>
	);
}
