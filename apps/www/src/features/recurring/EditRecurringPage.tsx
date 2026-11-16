import type { Household } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { DeleteRecurringButton } from "@/features/recurring/DeleteRecurringButton";
import { RecurringBackLink } from "@/features/recurring/RecurringBackLink";
import { RecurringForm } from "@/features/recurring/RecurringForm";
import { RecurringItem } from "@/features/recurring/RecurringItem";
import { recurringQueryOptions } from "@/features/recurring/recurring-query";
import { useRecurringChange } from "@/features/recurring/use-recurring-change";
import { useSharingContext } from "@/features/sharing/sharing-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { writableAccounts } from "@/features/transactions/transaction-form";
import { getApi } from "@/lib/api";
import { m } from "@/paraglide/messages";

interface EditRecurringPageProps {
	household: Household;
	recurringId: string;
	/** Called once it is saved or deleted. */
	onDone: () => void | Promise<void>;
}

/**
 * Changes or deletes a recurring transaction, for the holders of its
 * account; the other members who may see it read it.
 */
export function EditRecurringPage({
	household,
	recurringId,
	onDone,
}: EditRecurringPageProps) {
	const { data: recurring } = useSuspenseQuery(
		recurringQueryOptions(household.id, recurringId),
	);
	const { data: accounts } = useSuspenseQuery(
		accountsQueryOptions(household.id),
	);
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const sharing = useSharingContext(household);
	const refresh = useRecurringChange(household.id);
	const finish = async (message: string) => {
		// Leave first: the page must not reload one that no longer exists
		await onDone();
		toast.success(message);
		await refresh();
	};
	const canEdit = writableAccounts(accounts.items).some(
		(account) => account.id === recurring.transaction.accountId,
	);

	return (
		<section className="mx-auto grid max-w-md gap-6 px-4 py-12">
			<RecurringBackLink />
			<h1 className="font-heading font-semibold text-2xl">
				{m.recurring_edit_title()}
			</h1>
			{canEdit ? (
				<>
					<RecurringForm
						currency={household.currency}
						timeZone={household.timeZone}
						sharing={sharing}
						accounts={accounts.items}
						tags={tags}
						recurring={recurring}
						submitLabel={m.save_button()}
						save={(input) =>
							getApi().recurring.replace(household.id, recurring.id, input)
						}
						onSaved={() => finish(m.toast_recurring_saved())}
					/>
					<div className="justify-self-start">
						<DeleteRecurringButton
							recurring={recurring}
							onDeleted={() => finish(m.toast_recurring_deleted())}
						/>
					</div>
				</>
			) : (
				<>
					<ul>
						<RecurringItem
							recurring={recurring}
							accounts={accounts.items}
							tags={tags}
							currency={household.currency}
						/>
					</ul>
					<p className="text-muted-foreground">{m.recurring_read_only()}</p>
				</>
			)}
		</section>
	);
}
