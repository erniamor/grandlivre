import type { Household, Profile } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { AccountForm } from "@/features/accounts/AccountForm";
import { AccountsBackLink } from "@/features/accounts/AccountsBackLink";
import { AdjustBalanceDialog } from "@/features/accounts/AdjustBalanceDialog";
import { ArchiveAccountButton } from "@/features/accounts/ArchiveAccountButton";
import { canEditAccount } from "@/features/accounts/account-form";
import {
	accountQueryOptions,
	accountsQueryKey,
} from "@/features/accounts/accounts-query";
import { DeleteAccountButton } from "@/features/accounts/DeleteAccountButton";
import { householdMembersQueryOptions } from "@/features/households/household-members-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
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
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
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
			{account.archived && (
				<p className="rounded-lg border border-border bg-muted p-3 text-sm">
					{m.account_archived_notice()}
				</p>
			)}
			{/* Its holders bring it to what it really holds */}
			{account.isHolder && !account.archived && (
				<div className="grid gap-2 rounded-lg border border-border p-4">
					<p className="text-muted-foreground text-sm">
						{account.type === "cash"
							? m.account_count_hint()
							: m.account_adjust_hint()}
					</p>
					<div>
						<AdjustBalanceDialog
							household={household}
							account={account}
							tags={tags}
						/>
					</div>
				</div>
			)}
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
					<div className="grid gap-2 border-border border-t pt-6">
						<p className="text-muted-foreground text-sm">
							{m.account_archive_hint()}
						</p>
						<div className="flex flex-wrap gap-2">
							<ArchiveAccountButton
								account={account}
								onChanged={(changed) =>
									finish(
										changed.archived
											? m.toast_account_archived()
											: m.toast_account_unarchived(),
									)
								}
							/>
							<DeleteAccountButton
								account={account}
								onDeleted={() => finish(m.toast_account_deleted())}
							/>
						</div>
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
