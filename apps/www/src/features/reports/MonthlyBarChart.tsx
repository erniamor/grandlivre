import {
	Bar,
	BarChart,
	CartesianGrid,
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	XAxis,
	YAxis,
} from "@repo/ui";
import { useId } from "react";
import { monthLabel } from "@/features/reports/month-label";
import { formatAmount, formatAmountCompact } from "@/lib/money";
import { getLocale } from "@/paraglide/runtime";

export interface MonthAmount {
	/** "2026-11". */
	month: string;
	/** In minor units, zero or positive. */
	amount: number;
}

interface MonthlyBarChartProps {
	title: string;
	months: MonthAmount[];
	currency: string;
	/** The top of the scale: the same for the charts read side by side. */
	max: number;
}

/**
 * One amount a month, as bars on a scale starting at zero. A single series,
 * in the theme's primary color: its title names it, no legend.
 */
export function MonthlyBarChart({
	title,
	months,
	currency,
	max,
}: MonthlyBarChartProps) {
	const locale = getLocale();
	const titleId = useId();
	const config = {
		amount: { label: title, color: "var(--primary)" },
	} satisfies ChartConfig;
	const data = months.map(({ month, amount }) => ({
		month,
		label: monthLabel(month, locale, "short"),
		full: monthLabel(month, locale, "long"),
		amount,
	}));

	return (
		<figure aria-labelledby={titleId} className="grid gap-2">
			<figcaption id={titleId} className="font-medium text-sm">
				{title}
			</figcaption>
			<ChartContainer config={config} className="aspect-auto h-44 w-full">
				<BarChart data={data} accessibilityLayer margin={{ left: 0, right: 0 }}>
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
								formatter={(value) => (
									<span className="font-medium tabular-nums">
										{formatAmount(Number(value), currency, locale)}
									</span>
								)}
							/>
						}
					/>
					<Bar
						dataKey="amount"
						fill="var(--color-amount)"
						radius={[4, 4, 0, 0]}
						maxBarSize={28}
					/>
				</BarChart>
			</ChartContainer>
		</figure>
	);
}
