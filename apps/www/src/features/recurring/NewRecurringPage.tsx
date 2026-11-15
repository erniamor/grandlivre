import type { Household } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { RecurringBackLink } from "@/features/recurring/RecurringBackLink";
import { RecurringForm } from "@/features/recurring/RecurringForm";
import { useRecurringChange } from "@/features/recurring/use-recurring-change";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { getApi } from "@/lib/api";
import { m } from "@/paraglide/messages";

interface NewRecurringPageProps {
	household: Household;
	/** The account proposed, when the user holds it. */
	accountId?: string;
	onCreated: () => void | Promise<void>;
}

/** Creates a recurring transaction on an account the user holds. */
export function NewRecurringPage({
	household,
	accountId,
	onCreated,
}: NewRecurringPageProps) {
	const { data: accounts } = useSuspenseQuery(
		accountsQueryOptions(household.id),
	);
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const refresh = useRecurringChange(household.id);

	return (
		<section className="mx-auto grid max-w-md gap-6 px-4 py-12">
			<RecurringBackLink />
			<h1 className="font-heading font-semibold text-2xl">
				{m.recurring_new_title()}
			</h1>
			<RecurringForm
				currency={household.currency}
				timeZone={household.timeZone}
				accounts={accounts.items}
				tags={tags}
				defaultAccountId={accountId}
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
