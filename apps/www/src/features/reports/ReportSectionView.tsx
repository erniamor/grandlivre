import { useId } from "react";
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
}

/** The expenses or the incomes of the period, tag by tag. */
export function ReportSectionView({
	title,
	section,
	currency,
	emptyText,
}: ReportSectionViewProps) {
	const titleId = useId();

	return (
		<section aria-labelledby={titleId} className="grid gap-2">
			<div className="flex items-baseline justify-between gap-3">
				<h2 id={titleId} className="font-heading font-semibold text-lg">
					{title}
				</h2>
				<p className="whitespace-nowrap font-medium tabular-nums">
					{formatAmount(section.total, currency, getLocale())}
				</p>
			</div>
			{section.total === 0 ? (
				<p className="text-muted-foreground">{emptyText}</p>
			) : (
				<ul className="grid">
					{section.nodes.map((node) => (
						<ReportNodeItem key={node.tag.id} node={node} currency={currency} />
					))}
					{section.uncategorized > 0 && (
						<li className="flex py-2 pl-6">
							<ReportRow
								name={m.transaction_uncategorized()}
								amount={section.uncategorized}
								share={section.uncategorized / section.total}
								currency={currency}
							/>
						</li>
					)}
				</ul>
			)}
		</section>
	);
}
