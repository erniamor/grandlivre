import type { Transaction } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { ConfirmButton } from "@/components/ConfirmButton";
import { getApi } from "@/lib/api";
import { actionErrorMessage } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

interface DeleteTransactionButtonProps {
	transaction: Transaction;
	onDeleted: () => void | Promise<void>;
}

/** Deletes a transaction, after a confirmation. */
export function DeleteTransactionButton({
	transaction,
	onDeleted,
}: DeleteTransactionButtonProps) {
	const remove = useMutation({
		mutationFn: () =>
			getApi().transactions.remove(transaction.householdId, transaction.id),
		onSuccess: onDeleted,
		onError: (error) => {
			toast.error(actionErrorMessage(error));
		},
	});

	return (
		<ConfirmButton
			label={m.transaction_delete_button()}
			title={m.transaction_delete_title()}
			description={m.transaction_delete_text()}
			confirmLabel={m.transaction_delete_confirm()}
			pending={remove.isPending}
			onConfirm={() => remove.mutate()}
		/>
	);
}
