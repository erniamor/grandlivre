import type { Locale, MonthTotal, Tag, TagReport } from "@repo/schemas";
import {
	buildTagTree,
	subtreeIds,
	type TagNode,
} from "@/features/tags/tag-tree";

/** A tag of a report: what it and the tags under it gathered. */
export interface ReportNode {
	tag: Tag;
	/** In the user's language. */
	name: string;
	/**
	 * In minor units, positive. Below a tag, a sub-tag that went the other
	 * way (a refund under an expense) is negative: it lowers its parent.
	 */
	amount: number;
	/** Its part of the section's total, from 0 to 1. */
	share: number;
	/** The biggest first. */
	children: ReportNode[];
}

/** The expenses or the incomes of a period. */
export interface ReportSection {
	/** In minor units. */
	total: number;
	/** The tags at the top of the tree; the biggest first. */
	nodes: ReportNode[];
	/** The lines without a tag. */
	uncategorized: number;
}

export interface ReportView {
	expenses: ReportSection;
	incomes: ReportSection;
	/** Incomes minus expenses: what the period left, or took. */
	balance: number;
	/** Whether the period had any line at all. */
	isEmpty: boolean;
}

/** A tag with the net of what it and its sub-tags gathered: incomes minus expenses. */
interface NetNode {
	node: TagNode;
	net: number;
	children: NetNode[];
}

function withNets(nodes: TagNode[], ownNet: Map<string, number>): NetNode[] {
	return nodes.map((node) => {
		const children = withNets(node.children, ownNet);
		const net = children.reduce(
			(total, child) => total + child.net,
			ownNet.get(node.tag.id) ?? 0,
		);
		return { node, net, children };
	});
}

/**
 * The tags of a section: `sign` is -1 for the expenses, 1 for the incomes.
 * Tags whose total is nil are left out.
 */
function toReportNodes(
	nodes: NetNode[],
	sign: -1 | 1,
	sectionTotal: number,
): ReportNode[] {
	return nodes
		.filter(({ net }) => net !== 0)
		.map(({ node, net, children }) => {
			const amount = net * sign;
			return {
				tag: node.tag,
				name: node.name,
				amount,
				share: sectionTotal === 0 ? 0 : amount / sectionTotal,
				children: toReportNodes(children, sign, sectionTotal),
			};
		})
		.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

/**
 * Builds what a report shows from the API's amounts and the household's tags.
 * Each tag counts the incomes against the expenses, so a refund lowers what
 * its tag cost: a tag is an expense if, with its sub-tags, it cost more than
 * it brought in, and an income otherwise. The uncategorized lines don't net
 * out: an uncategorized salary would hide uncategorized expenses.
 */
export function buildReport(
	report: TagReport,
	tags: Tag[],
	locale: Locale,
): ReportView {
	const ownNet = new Map<string, number>();
	let uncategorizedExpense = 0;
	let uncategorizedIncome = 0;
	for (const { tagId, expense, income } of report.tags) {
		if (tagId === null) {
			uncategorizedExpense += expense;
			uncategorizedIncome += income;
		} else {
			ownNet.set(tagId, income - expense);
		}
	}
	const roots = withNets(buildTagTree(tags, locale), ownNet);
	const spent = roots.filter(({ net }) => net < 0);
	const earned = roots.filter(({ net }) => net > 0);
	const expenseTotal =
		uncategorizedExpense - spent.reduce((total, { net }) => total + net, 0);
	const incomeTotal =
		uncategorizedIncome + earned.reduce((total, { net }) => total + net, 0);

	return {
		expenses: {
			total: expenseTotal,
			nodes: toReportNodes(spent, -1, expenseTotal),
			uncategorized: uncategorizedExpense,
		},
		incomes: {
			total: incomeTotal,
			nodes: toReportNodes(earned, 1, incomeTotal),
			uncategorized: uncategorizedIncome,
		},
		balance: incomeTotal - expenseTotal,
		isEmpty: report.tags.length === 0,
	};
}

/**
 * A month's expenses and incomes, counted as a report counts a period: a
 * refund lowers its tag's expenses. With `tagId`, only that tag and the tags
 * under it, as its line in the report.
 */
export function monthTotals(
	month: MonthTotal,
	tags: Tag[],
	locale: Locale,
	tagId?: string,
): { expense: number; income: number } {
	const kept = tagId ? subtreeIds(tags, tagId) : undefined;
	const view = buildReport(
		{
			from: month.month,
			to: month.month,
			tags: kept
				? month.tags.filter(
						(total) => total.tagId !== null && kept.has(total.tagId),
					)
				: month.tags,
		},
		tags,
		locale,
	);
	return { expense: view.expenses.total, income: view.incomes.total };
}
