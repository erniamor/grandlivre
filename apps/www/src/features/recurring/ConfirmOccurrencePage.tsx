import type { Household } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { RecurringBackLink } from "@/features/recurring/RecurringBackLink";
import { pendingQueryOptions } from "@/features/recurring/recurring-query";
import {
	draftOfOccurrence,
	templateTitle,
} from "@/features/recurring/recurring-view";
import { SkipOccurrenceButton } from "@/features/recurring/SkipOccurrenceButton";
import { useRecurringChange } from "@/features/recurring/use-recurring-change";
import { useSharingContext } from "@/features/sharing/sharing-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { TransactionForm } from "@/features/transactions/TransactionForm";
import { useTransactionChange } from "@/features/transactions/use-transaction-change";
import { getApi } from "@/lib/api";
import { formatDay } from "@/lib/dates";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface ConfirmOccurrencePageProps {
	household: Household;
	occurrenceId: string;
	/** Called once the day is recorded or skipped. */
	onDone: () => void | Promise<void>;
}

/**
 * A waiting day of a recurring transaction, in the transaction form: the
 * member checks it (its amount, its day...), then records it, or skips it.
 */
export function ConfirmOccurrencePage({
	household,
	occurrenceId,
	onDone,
}: ConfirmOccurrencePageProps) {
	const { data: pending } = useSuspenseQuery(pendingQueryOptions(household.id));
	const { data: accounts } = useSuspenseQuery(
		accountsQueryOptions(household.id),
	);
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const sharing = useSharingContext(household);
	const refreshTransactions = useTransactionChange(household.id);
	const refreshRecurring = useRecurringChange(household.id);
	const occurrence = pending.items.find((item) => item.id === occurrenceId);

	return (
		<section className="mx-auto grid max-w-md gap-6 px-4 py-12">
			<RecurringBackLink />
			<h1 className="font-heading font-semibold text-2xl">
				{m.occurrence_confirm_title()}
			</h1>
			{occurrence ? (
				<>
					<p className="text-muted-foreground">
						{m.occurrence_confirm_intro({
							name: templateTitle(occurrence.recurring.transaction),
							date: formatDay(occurrence.date, getLocale()),
						})}
					</p>
					<TransactionForm
						currency={household.currency}
						accounts={accounts.items}
						tags={tags}
						draft={draftOfOccurrence(occurrence.date, occurrence.recurring)}
						sharing={sharing}
						initialShares={occurrence.recurring.transaction.shares}
						submitLabel={m.occurrence_confirm_button()}
						save={(input) =>
							getApi().recurring.confirm(household.id, occurrence.id, input)
						}
						onSaved={async () => {
							// Leave first: the day no longer waits
							await onDone();
							toast.success(m.toast_occurrence_recorded());
							await Promise.all([refreshTransactions(), refreshRecurring()]);
						}}
					/>
					<div className="justify-self-start">
						<SkipOccurrenceButton
							householdId={household.id}
							occurrenceId={occurrence.id}
							date={occurrence.date}
							title={templateTitle(occurrence.recurring.transaction)}
							onSkipped={onDone}
						/>
					</div>
				</>
			) : (
				<p className="text-muted-foreground">{m.occurrence_handled()}</p>
			)}
		</section>
	);
}
