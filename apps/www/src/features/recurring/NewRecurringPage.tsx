import type { Household, Transaction } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { RecurringBackLink } from "@/features/recurring/RecurringBackLink";
import { RecurringForm } from "@/features/recurring/RecurringForm";
import { useRecurringChange } from "@/features/recurring/use-recurring-change";
import { useSharingContext } from "@/features/sharing/sharing-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { getApi } from "@/lib/api";
import { m } from "@/paraglide/messages";

interface NewRecurringPageProps {
	household: Household;
	/** The account proposed, when the user holds it. */
	accountId?: string;
	/** A transaction to make recurring: the form starts from it. */
	from?: Transaction;
	onCreated: () => void | Promise<void>;
}

/**
 * Creates a recurring transaction on an account the user holds, from
 * scratch or from a transaction.
 */
export function NewRecurringPage({
	household,
	accountId,
	from,
	onCreated,
}: NewRecurringPageProps) {
	const { data: accounts } = useSuspenseQuery(
		accountsQueryOptions(household.id),
	);
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const sharing = useSharingContext(household);
	const refresh = useRecurringChange(household.id);

	return (
		<section className="mx-auto grid max-w-md gap-6 px-4 py-12">
			<RecurringBackLink />
			<h1 className="font-heading font-semibold text-2xl">
				{m.recurring_new_title()}
			</h1>
			{from && (
				<p className="text-muted-foreground">{m.recurring_from_intro()}</p>
			)}
			<RecurringForm
				currency={household.currency}
				timeZone={household.timeZone}
				sharing={sharing}
				accounts={accounts.items}
				tags={tags}
				defaultAccountId={accountId}
				from={from}
				submitLabel={m.recurring_create_button()}
				save={(input) => getApi().recurring.create(household.id, input)}
				onSaved={async () => {
					await refresh();
					toast.success(m.toast_recurring_created());
					await onCreated();
				}}
			/>
		</section>
	);
}
