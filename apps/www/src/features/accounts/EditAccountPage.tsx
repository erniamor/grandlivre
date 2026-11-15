import type { Household, Profile } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { AccountForm } from "@/features/accounts/AccountForm";
import { AccountsBackLink } from "@/features/accounts/AccountsBackLink";
import { canEditAccount } from "@/features/accounts/account-form";
import {
	accountQueryOptions,
	accountsQueryKey,
} from "@/features/accounts/accounts-query";
import { DeleteAccountButton } from "@/features/accounts/DeleteAccountButton";
import { householdMembersQueryOptions } from "@/features/households/household-members-query";
import { getApi } from "@/lib/api";
import { m } from "@/paraglide/messages";

interface EditAccountPageProps {
	me: Profile;
	household: Household;
	accountId: string;
	/** Called once the account is saved or deleted. */
	onDone: () => void | Promise<void>;
}

/** Changes or deletes an account; only those who may see the form. */
export function EditAccountPage({
	me,
	household,
	accountId,
	onDone,
}: EditAccountPageProps) {
	const queryClient = useQueryClient();
	const { data: account } = useSuspenseQuery(
		accountQueryOptions(household.id, accountId),
	);
	const { data: members } = useSuspenseQuery(
		householdMembersQueryOptions(household.id),
	);
	const finish = async (message: string) => {
		// Leave first: the page must not reload an account that no longer exists
		await onDone();
		toast.success(message);
		await queryClient.invalidateQueries({
			queryKey: accountsQueryKey(household.id),
		});
	};

	return (
		<section className="mx-auto grid max-w-md gap-6 px-4 py-12">
			<AccountsBackLink />
			<h1 className="font-heading font-semibold text-2xl">
				{m.account_edit_title()}
			</h1>
			{canEditAccount(account, household.role === "owner") ? (
				<>
					<AccountForm
						currency={household.currency}
						members={members.items}
						meId={me.id}
						account={account}
						submitLabel={m.save_button()}
						save={(input) =>
							getApi().accounts.update(household.id, account.id, input)
						}
						onSaved={() => finish(m.toast_account_saved())}
					/>
					<div className="justify-self-start">
						<DeleteAccountButton
							account={account}
							onDeleted={() => finish(m.toast_account_deleted())}
						/>
					</div>
				</>
			) : (
				<p className="text-muted-foreground">
					{account.name} · {m.account_read_only()}
				</p>
			)}
		</section>
	);
}
