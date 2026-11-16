import type { Household } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BudgetForm } from "@/features/budgets/BudgetForm";
import { BudgetsBackLink } from "@/features/budgets/BudgetsBackLink";
import { budgetsQueryOptions } from "@/features/budgets/budgets-query";
import { StopBudgetButton } from "@/features/budgets/StopBudgetButton";
import { useBudgetsChange } from "@/features/budgets/use-budgets-change";
import { buildTagTree, flattenTagTree } from "@/features/tags/tag-tree";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { getApi } from "@/lib/api";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface BudgetPageProps {
	household: Household;
	/** The month shown: "2026-11". */
	month: string;
	/** The tag of the budget; without it, the page adds one. */
	tagId?: string;
	/** Called once the budget is set or stopped. */
	onDone: () => void | Promise<void>;
}

/**
 * Adds a budget, or changes the one of a tag as it stands in the month
 * shown, or stops it from that month on.
 */
export function BudgetPage({
	household,
	month,
	tagId,
	onDone,
}: BudgetPageProps) {
	const { data } = useSuspenseQuery(budgetsQueryOptions(household.id, month));
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const refresh = useBudgetsChange(household.id);
	const budget = data.budgets.find((each) => each.tagId === tagId);
	const name = flattenTagTree(buildTagTree(tags, getLocale())).find(
		({ tag }) => tag.id === tagId,
	)?.path;
	const finish = async (message: string) => {
		await refresh();
		toast.success(message);
		await onDone();
	};

	return (
		<section className="mx-auto grid max-w-md gap-6 px-4 py-12">
			<BudgetsBackLink month={month} />
			<h1 className="font-heading font-semibold text-2xl">
				{name ? m.budget_of_title({ name }) : m.budget_new_title()}
			</h1>
			<BudgetForm
				householdId={household.id}
				currency={household.currency}
				tags={tags}
				month={month}
				tagId={tagId}
				budget={budget}
				submitLabel={m.save_button()}
				save={(tag, input) => getApi().budgets.set(household.id, tag, input)}
				onSaved={() => finish(m.toast_budget_saved())}
			/>
			{budget && tagId && (
				<div className="justify-self-start">
					<StopBudgetButton
						householdId={household.id}
						tagId={tagId}
						from={month}
						onStopped={() => finish(m.toast_budget_stopped())}
					/>
				</div>
			)}
		</section>
	);
}
