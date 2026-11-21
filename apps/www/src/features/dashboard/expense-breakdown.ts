import type { ReportView } from "@/features/reports/report-tree";

/**
 * A row of the breakdown: a tag at the top of the tree, the uncategorized
 * lines (still to categorize, or undetermined), or the rest.
 */
export interface BreakdownRow {
	kind: "tag" | "uncategorized" | "undetermined" | "others";
	/** The tag's id, for a tag. */
	tagId: string | null;
	/** The tag's name, in the user's language; empty for the other kinds. */
	name: string;
	/** In minor units, positive. */
	amount: number;
	/** Its part of the expenses, from 0 to 1. */
	share: number;
}

/** How many rows a breakdown shows before gathering the rest. */
export const BREAKDOWN_ROWS = 5;

/**
 * The period's expenses by tag at the top of the tree, the biggest first,
 * the uncategorized lines and the undetermined ones as two of them; past `limit` rows, the rest
 * gathered in one "others" row, last.
 */
export function expenseBreakdown(
	view: ReportView,
	limit: number = BREAKDOWN_ROWS,
): BreakdownRow[] {
	const { total, nodes, uncategorized, undetermined } = view.expenses;
	if (total <= 0) {
		return [];
	}
	const share = (amount: number) => amount / total;
	const rows: BreakdownRow[] = [
		...nodes.map((node) => ({
			kind: "tag" as const,
			tagId: node.tag.id,
			name: node.name,
			amount: node.amount,
			share: share(node.amount),
		})),
		...(uncategorized > 0
			? [
					{
						kind: "uncategorized" as const,
						tagId: null,
						name: "",
						amount: uncategorized,
						share: share(uncategorized),
					},
				]
			: []),
		...(undetermined > 0
			? [
					{
						kind: "undetermined" as const,
						tagId: null,
						name: "",
						amount: undetermined,
						share: share(undetermined),
					},
				]
			: []),
	].sort((a, b) => b.amount - a.amount);
	if (rows.length <= limit) {
		return rows;
	}
	// The last row shown makes room for the others
	const shown = rows.slice(0, limit - 1);
	const rest = rows.slice(limit - 1).reduce((sum, row) => sum + row.amount, 0);
	return [
		...shown,
		{ kind: "others", tagId: null, name: "", amount: rest, share: share(rest) },
	];
}
