import type { Household, Profile } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { AccountForm } from "@/features/accounts/AccountForm";
import { AccountsBackLink } from "@/features/accounts/AccountsBackLink";
import { accountsQueryKey } from "@/features/accounts/accounts-query";
import { householdMembersQueryOptions } from "@/features/households/household-members-query";
import { getApi } from "@/lib/api";
import { m } from "@/paraglide/messages";

interface NewAccountPageProps {
	me: Profile;
	household: Household;
	/** Called once the account is created. */
	onCreated: () => void | Promise<void>;
}

/** Creates an account in the household, held by the signed-in user. */
export function NewAccountPage({
	me,
	household,
	onCreated,
}: NewAccountPageProps) {
	const queryClient = useQueryClient();
	const { data: members } = useSuspenseQuery(
		householdMembersQueryOptions(household.id),
	);

	return (
		<section className="mx-auto grid max-w-md gap-6 px-4 py-12">
			<AccountsBackLink />
			<h1 className="font-heading font-semibold text-2xl">
				{m.account_new_title()}
			</h1>
			<AccountForm
				currency={household.currency}
				members={members.items}
				meId={me.id}
				submitLabel={m.account_create_button()}
				save={({ openingBalance = 0, ...input }) =>
					getApi().accounts.create(household.id, { ...input, openingBalance })
				}
				onSaved={async () => {
					await queryClient.invalidateQueries({
						queryKey: accountsQueryKey(household.id),
					});
					toast.success(m.toast_account_created());
					await onCreated();
				}}
			/>
		</section>
	);
}
