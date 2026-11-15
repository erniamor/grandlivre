import { ReportRow } from "@/features/reports/ReportRow";
import type { ReportNode } from "@/features/reports/report-tree";

interface ReportNodeItemProps {
	node: ReportNode;
	currency: string;
}

/**
 * A tag of a report. One with sub-tags opens to show them: a native
 * disclosure, reachable and opened with the keyboard.
 */
export function ReportNodeItem({ node, currency }: ReportNodeItemProps) {
	const row = (
		<ReportRow
			name={node.name}
			amount={node.amount}
			share={node.share}
			currency={currency}
		/>
	);

	if (node.children.length === 0) {
		return <li className="flex py-2 pl-6">{row}</li>;
	}
	return (
		<li>
			<details className="group">
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
						/>
					))}
				</ul>
			</details>
		</li>
	);
}
