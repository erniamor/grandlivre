import type { Household, Tag } from "@repo/schemas";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { SelectField, type SelectOption } from "@/components/SelectField";
import { MonthlyBarChart } from "@/features/reports/MonthlyBarChart";
import { MonthlyTable } from "@/features/reports/MonthlyTable";
import type { Period } from "@/features/reports/period";
import { monthTotals } from "@/features/reports/report-tree";
import { monthlyReportQueryOptions } from "@/features/reports/reports-query";
import { buildTagTree, flattenTagTree } from "@/features/tags/tag-tree";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface ReportTrendProps {
	household: Household;
	period: Period;
	tags: Tag[];
}

// A select's value is a string: this one stands for "every tag"
const ALL = "";

/**
 * The twelve months ending with the period, for the whole household or one
 * tag: the expenses, then the incomes, on the same scale.
 */
export function ReportTrend({ household, period, tags }: ReportTrendProps) {
	const locale = getLocale();
	const titleId = useId();
	const [tagId, setTagId] = useState(ALL);
	const { data: report } = useSuspenseQuery(
		monthlyReportQueryOptions(household.id, period),
	);
	const months = report.months.map((month) => ({
		month: month.month,
		...monthTotals(month, tags, locale, tagId || undefined),
	}));
	const max = Math.max(
		0,
		...months.flatMap(({ expense, income }) => [expense, income]),
	);
	const tagOptions: SelectOption<string>[] = [
		{ value: ALL, label: m.report_trend_all_tags() },
		...flattenTagTree(buildTagTree(tags, locale)).map(({ tag, path }) => ({
			value: tag.id,
			label: path,
		})),
	];
	const hasIncome = months.some(({ income }) => income > 0);
	const hasExpense = months.some(({ expense }) => expense > 0);

	return (
		<section aria-labelledby={titleId} className="grid gap-4">
			<h2 id={titleId} className="font-heading font-semibold text-lg">
				{m.report_trend_title()}
			</h2>
			<SelectField
				label={m.transaction_tag_label()}
				value={tagId}
				options={tagOptions}
				onChange={setTagId}
				tone="default"
				className="grid items-stretch font-medium"
			/>
			{max === 0 ? (
				<p className="text-muted-foreground">{m.report_trend_empty()}</p>
			) : (
				<>
					{hasExpense && (
						<MonthlyBarChart
							title={m.report_trend_expenses()}
							months={months.map(({ month, expense }) => ({
								month,
								amount: expense,
							}))}
							currency={household.currency}
							max={max}
						/>
					)}
					{hasIncome && (
						<MonthlyBarChart
							title={m.report_trend_incomes()}
							months={months.map(({ month, income }) => ({
								month,
								amount: income,
							}))}
							currency={household.currency}
							max={max}
						/>
					)}
					<MonthlyTable months={months} currency={household.currency} />
				</>
			)}
		</section>
	);
}
