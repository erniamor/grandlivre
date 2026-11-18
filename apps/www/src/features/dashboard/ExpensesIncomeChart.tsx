import {
	Bar,
	CartesianGrid,
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
	ComposedChart,
	Line,
	XAxis,
	YAxis,
} from "@repo/ui";
import { useId } from "react";
import { monthLabel } from "@/features/reports/month-label";
import { formatAmount, formatAmountCompact } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

export interface MonthExpenseIncome {
	/** "2026-11". */
	month: string;
	/** In minor units, zero or positive. */
	expense: number;
	income: number;
}

interface ExpensesIncomeChartProps {
	/** Read by screen readers: a heading above already shows it. */
	title: string;
	months: MonthExpenseIncome[];
	currency: string;
}

/**
 * Each month's expenses as bars, and its incomes as a line over them, on
 * one scale starting at zero. Told apart by their shape, not their color
 * alone: the bars in the theme's primary color, the line in its text color;
 * a legend names both.
 */
export function ExpensesIncomeChart({
	title,
	months,
	currency,
}: ExpensesIncomeChartProps) {
	const locale = getLocale();
	const titleId = useId();
	const config = {
		expense: {
			label: m.dashboard_monthly_expenses(),
			color: "var(--primary)",
		},
		income: {
			label: m.dashboard_monthly_incomes(),
			color: "var(--foreground)",
		},
	} satisfies ChartConfig;
	const data = months.map(({ month, expense, income }) => ({
		label: monthLabel(month, locale, "short"),
		full: monthLabel(month, locale, "long"),
		expense,
		income,
	}));
	const max = Math.max(
		0,
		...months.flatMap(({ expense, income }) => [expense, income]),
	);

	return (
		<figure aria-labelledby={titleId} className="grid gap-2">
			<figcaption id={titleId} className="sr-only">
				{title}
			</figcaption>
			<ChartContainer config={config} className="aspect-auto h-52 w-full">
				<ComposedChart
					data={data}
					accessibilityLayer
					margin={{ left: 0, right: 4, top: 8 }}
				>
					<CartesianGrid vertical={false} stroke="var(--border)" />
					<XAxis
						dataKey="label"
						tickLine={false}
						axisLine={false}
						tickMargin={8}
						interval="preserveStartEnd"
					/>
					<YAxis
						domain={[0, max]}
						tickLine={false}
						axisLine={false}
						width={56}
						tickCount={4}
						tickFormatter={(value: number) =>
							formatAmountCompact(value, currency, locale)
						}
					/>
					<ChartTooltip
						cursor={{ fill: "var(--muted)" }}
						content={
							<ChartTooltipContent
								labelFormatter={(_, payload) => payload[0]?.payload.full}
								formatter={(value, name) => (
									<span className="flex w-full justify-between gap-4">
										<span className="text-muted-foreground">
											{config[name as keyof typeof config]?.label}
										</span>
										<span className="font-medium tabular-nums">
											{formatAmount(Number(value), currency, locale)}
										</span>
									</span>
								)}
							/>
						}
					/>
					<ChartLegend content={<ChartLegendContent />} />
					<Bar
						dataKey="expense"
						fill="var(--color-expense)"
						radius={[4, 4, 0, 0]}
						maxBarSize={28}
					/>
					<Line
						dataKey="income"
						type="linear"
						stroke="var(--color-income)"
						strokeWidth={2}
						dot={{
							r: 4,
							fill: "var(--color-income)",
							stroke: "var(--card)",
							strokeWidth: 2,
						}}
						activeDot={{ r: 5 }}
					/>
				</ComposedChart>
			</ChartContainer>
		</figure>
	);
}
