import type { Period } from "@/features/reports/period";
import { ReportRow } from "@/features/reports/ReportRow";
import type { ReportNode } from "@/features/reports/report-tree";
import { TagTransactionsLink } from "@/features/reports/TagTransactionsLink";

interface ReportNodeItemProps {
	node: ReportNode;
	currency: string;
	/** The report's period: a tag links to its transactions over it. */
	period: Period;
}

/**
 * A tag of a report. One with sub-tags opens to show them: a native
 * disclosure, reachable and opened with the keyboard. The link to its
 * transactions sits apart, at the end of the line, so that opening the tag
 * and leaving for its transactions are two different gestures.
 */
export function ReportNodeItem({
	node,
	currency,
	period,
}: ReportNodeItemProps) {
	const row = (
		<ReportRow
			name={node.name}
			amount={node.amount}
			share={node.share}
			currency={currency}
		/>
	);
	const link = (
		<TagTransactionsLink tagId={node.tag.id} name={node.name} period={period} />
	);

	if (node.children.length === 0) {
		return (
			<li className="flex items-start gap-2 py-2 pl-6">
				{row}
				{link}
			</li>
		);
	}
	return (
		<li className="flex items-start gap-2">
			<details className="group flex-1">
				<summary className="flex cursor-pointer list-none items-start gap-2 rounded-md py-2 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
					<span
						aria-hidden
						className="w-4 text-muted-foreground transition-transform group-open:rotate-90"
					>
						›
					</span>
					{row}
				</summary>
				<ul className="ml-6 border-border border-l pl-2">
					{node.children.map((child) => (
						<ReportNodeItem
							key={child.tag.id}
							node={child}
							currency={currency}
							period={period}
						/>
					))}
				</ul>
			</details>
			<div className="py-1.5">{link}</div>
		</li>
	);
}
