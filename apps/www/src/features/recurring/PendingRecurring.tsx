import type { Household } from "@repo/schemas";
import { buttonVariants } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { OccurrenceItem } from "@/features/recurring/OccurrenceItem";
import { pendingQueryOptions } from "@/features/recurring/recurring-query";
import { templateTitle } from "@/features/recurring/recurring-view";
import { SkipOccurrenceButton } from "@/features/recurring/SkipOccurrenceButton";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { writableAccounts } from "@/features/transactions/transaction-form";
import { m } from "@/paraglide/messages";

interface PendingRecurringProps {
	household: Household;
}

/**
 * The days of the recurring transactions that wait for a member: to review
 * and record, or to skip, for the holders of their account. Nothing shows
 * when none waits.
 */
export function PendingRecurring({ household }: PendingRecurringProps) {
	const { data: pending } = useSuspenseQuery(pendingQueryOptions(household.id));
	const { data: accounts } = useSuspenseQuery(
		accountsQueryOptions(household.id),
	);
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const titleId = useId();

	if (pending.items.length === 0) {
		return null;
	}
	const mine = new Set(
		writableAccounts(accounts.items).map((account) => account.id),
	);

	return (
		<section aria-labelledby={titleId} className="grid gap-3">
			<div className="grid gap-1">
				<h2 id={titleId} className="font-heading font-semibold text-lg">
					{m.pending_recurring_title()}
				</h2>
				<p className="text-muted-foreground text-sm">
					{m.pending_recurring_intro()}
				</p>
			</div>
			<ul className="grid gap-2">
				{pending.items.map(({ id, date, recurring }) => (
					<OccurrenceItem
						key={id}
						date={date}
						recurring={recurring}
						accounts={accounts.items}
						tags={tags}
						currency={household.currency}
					>
						{mine.has(recurring.transaction.accountId) && (
							<>
								<Link
									to="/recurring/pending/$occurrenceId"
									params={{ occurrenceId: id }}
									aria-label={m.occurrence_review_label({
										name: templateTitle(recurring.transaction),
									})}
									className={buttonVariants({ size: "sm" })}
								>
									{m.occurrence_review_button()}
								</Link>
								<SkipOccurrenceButton
									householdId={household.id}
									occurrenceId={id}
									date={date}
									title={templateTitle(recurring.transaction)}
								/>
							</>
						)}
					</OccurrenceItem>
				))}
			</ul>
		</section>
	);
}
