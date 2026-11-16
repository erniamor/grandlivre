import type { Household } from "@repo/schemas";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useId } from "react";
import { HelpHint } from "@/features/help/HelpHint";
import { BalanceList } from "@/features/sharing/BalanceList";
import { DefaultSplitForm } from "@/features/sharing/DefaultSplitForm";
import { SettlementList } from "@/features/sharing/SettlementList";
import { SharedExpenseList } from "@/features/sharing/SharedExpenseList";
import { SuggestionList } from "@/features/sharing/SuggestionList";
import {
	settlementsQueryOptions,
	sharedExpensesQueryOptions,
	sharingOverviewQueryOptions,
} from "@/features/sharing/sharing-query";
import { m } from "@/paraglide/messages";

interface SharingPageProps {
	household: Household;
	meId: string;
}

/**
 * Who owes whom in the household, how to settle, the default split, and
 * the history of the shared expenses and of the settlements.
 */
export function SharingPage({ household, meId }: SharingPageProps) {
	const { data: overview } = useSuspenseQuery(
		sharingOverviewQueryOptions(household.id),
	);
	const { data: expenses } = useSuspenseQuery(
		sharedExpensesQueryOptions(household.id),
	);
	const { data: settlements } = useSuspenseQuery(
		settlementsQueryOptions(household.id),
	);
	const ids = {
		balances: useId(),
		settle: useId(),
		split: useId(),
		expenses: useId(),
		settlements: useId(),
	};
	const names = new Map(
		overview.balances.map(({ userId, name }) => [userId, name]),
	);
	const nameOf = (userId: string) =>
		names.get(userId) ?? m.sharing_former_member();
	const props = { nameOf, meId, currency: household.currency };

	return (
		<section className="mx-auto grid max-w-2xl gap-8 px-4 py-12">
			<header className="grid gap-2">
				<h1 className="font-heading font-semibold text-2xl">
					{m.sharing_title()}
				</h1>
				<p className="text-muted-foreground">{m.sharing_intro()}</p>
			</header>
			<section aria-labelledby={ids.balances} className="grid gap-3">
				<h2 id={ids.balances} className="font-heading font-semibold text-lg">
					{m.sharing_balances_title()}
				</h2>
				<BalanceList
					balances={overview.balances}
					meId={meId}
					currency={household.currency}
				/>
			</section>
			<section aria-labelledby={ids.settle} className="grid gap-3">
				<h2 id={ids.settle} className="font-heading font-semibold text-lg">
					{m.sharing_settle_title()}
				</h2>
				<SuggestionList suggestions={overview.suggestions} {...props} />
			</section>
			<section aria-labelledby={ids.split} className="grid gap-3">
				<div className="flex items-center gap-1">
					<h2 id={ids.split} className="font-heading font-semibold text-lg">
						{m.default_split_title()}
					</h2>
					<HelpHint topic="sharingSplit" />
				</div>
				<DefaultSplitForm
					household={household}
					weights={overview.weights}
					nameOf={nameOf}
				/>
			</section>
			<section aria-labelledby={ids.expenses} className="grid gap-3">
				<h2 id={ids.expenses} className="font-heading font-semibold text-lg">
					{m.shared_expenses_title()}
				</h2>
				<SharedExpenseList expenses={expenses.items} {...props} />
			</section>
			<section aria-labelledby={ids.settlements} className="grid gap-3">
				<h2 id={ids.settlements} className="font-heading font-semibold text-lg">
					{m.settlements_title()}
				</h2>
				<SettlementList
					householdId={household.id}
					settlements={settlements.items}
					{...props}
				/>
			</section>
		</section>
	);
}
