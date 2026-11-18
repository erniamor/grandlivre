import { cn } from "@repo/ui";
import { useId } from "react";
import { sensitiveClass } from "@/components/sensitive";
import type { Period } from "@/features/reports/period";
import { ReportNodeItem } from "@/features/reports/ReportNodeItem";
import { ReportRow } from "@/features/reports/ReportRow";
import type { ReportSection } from "@/features/reports/report-tree";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface ReportSectionViewProps {
	title: string;
	section: ReportSection;
	currency: string;
	/** Shown when the section has nothing. */
	emptyText: string;
	/** The report's period: each tag links to its transactions over it. */
	period: Period;
}

/** The expenses or the incomes of the period, tag by tag. */
export function ReportSectionView({
	title,
	section,
	currency,
	emptyText,
	period,
}: ReportSectionViewProps) {
	const titleId = useId();

	return (
		<section aria-labelledby={titleId} className="grid gap-2">
			<div className="flex items-baseline justify-between gap-3">
				<h2 id={titleId} className="font-heading font-semibold text-lg">
					{title}
				</h2>
				<p
					className={cn(
						"whitespace-nowrap font-medium tabular-nums",
						sensitiveClass,
					)}
				>
					{formatAmount(section.total, currency, getLocale())}
				</p>
			</div>
			{section.total === 0 ? (
				<p className="text-muted-foreground">{emptyText}</p>
			) : (
				<ul className="grid">
					{section.nodes.map((node) => (
						<ReportNodeItem
							key={node.tag.id}
							node={node}
							currency={currency}
							period={period}
						/>
					))}
					{section.uncategorized > 0 && (
						<li className="flex items-start gap-2 py-2 pl-6">
							<ReportRow
								name={m.transaction_uncategorized()}
								amount={section.uncategorized}
								share={section.uncategorized / section.total}
								currency={currency}
							/>
							{/* No filter for the uncategorized lines: an empty place keeps
							the amounts aligned with those of the tags */}
							<span aria-hidden className="size-7 shrink-0" />
						</li>
					)}
				</ul>
			)}
		</section>
	);
}
