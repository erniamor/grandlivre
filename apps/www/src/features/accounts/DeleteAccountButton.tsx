import type { Account } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { ConfirmButton } from "@/components/ConfirmButton";
import { getApi } from "@/lib/api";
import { actionErrorMessage } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

interface DeleteAccountButtonProps {
	account: Account;
	onDeleted: () => void | Promise<void>;
}

/** Deletes an account, after a confirmation. */
export function DeleteAccountButton({
	account,
	onDeleted,
}: DeleteAccountButtonProps) {
	const remove = useMutation({
		mutationFn: () => getApi().accounts.remove(account.householdId, account.id),
		onSuccess: onDeleted,
		onError: (error) => {
			toast.error(actionErrorMessage(error));
		},
	});

	return (
		<ConfirmButton
			label={m.account_delete_button()}
			title={m.account_delete_title({ name: account.name })}
			description={m.account_delete_text()}
			confirmLabel={m.account_delete_confirm()}
			pending={remove.isPending}
			onConfirm={() => remove.mutate()}
		/>
	);
}
