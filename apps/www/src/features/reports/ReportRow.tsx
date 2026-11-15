import { formatAmount } from "@/lib/money";
import { getLocale } from "@/paraglide/runtime";

interface ReportRowProps {
	name: string;
	/** In minor units; negative when it lowers its parent (a refund). */
	amount: number;
	/** Its part of the section's total, from 0 to 1. */
	share: number;
	currency: string;
}

/** One line of a report: a name, its part of the total, and its amount. */
export function ReportRow({ name, amount, share, currency }: ReportRowProps) {
	const locale = getLocale();
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	// A refund under its parent doesn't take any part of the bar
	const width = `${Math.min(Math.max(share, 0), 1) * 100}%`;

	return (
		<span className="grid flex-1 gap-1">
			<span className="flex items-baseline justify-between gap-3">
				<span className="min-w-0 break-words">{name}</span>
				<span className="flex shrink-0 items-baseline gap-3">
					<span className="text-muted-foreground text-sm tabular-nums">
						{percent.format(share)}
					</span>
					<span className="whitespace-nowrap font-medium tabular-nums">
						{formatAmount(amount, currency, locale)}
					</span>
				</span>
			</span>
			<span aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
				{/* An inline width: the share is only known at run time */}
				<span
					className="block h-full rounded-full bg-primary"
					style={{ width }}
				/>
			</span>
		</span>
	);
}
