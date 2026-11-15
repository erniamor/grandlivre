import type { Account } from "@repo/schemas";
import { Button, toast } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
import { getApi } from "@/lib/api";
import { actionErrorMessage } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

interface ArchiveAccountButtonProps {
	account: Account;
	/** Called with the account once it is archived, or brought back. */
	onChanged: (account: Account) => void | Promise<void>;
}

/**
 * Puts an account aside, or brings it back. No confirmation: nothing is
 * lost, and the same button undoes it.
 */
export function ArchiveAccountButton({
	account,
	onChanged,
}: ArchiveAccountButtonProps) {
	const toggle = useMutation({
		mutationFn: () =>
			getApi().accounts.update(account.householdId, account.id, {
				archived: !account.archived,
			}),
		onSuccess: onChanged,
		onError: (error) => {
			toast.error(actionErrorMessage(error));
		},
	});
	const Icon = account.archived ? ArchiveRestoreIcon : ArchiveIcon;

	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			disabled={toggle.isPending}
			onClick={() => toggle.mutate()}
		>
			<Icon aria-hidden />
			{account.archived
				? m.account_unarchive_button()
				: m.account_archive_button()}
		</Button>
	);
}
