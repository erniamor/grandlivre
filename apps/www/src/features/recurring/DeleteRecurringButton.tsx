import type { RecurringTransaction } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { ConfirmButton } from "@/components/ConfirmButton";
import { getApi } from "@/lib/api";
import { actionErrorMessage } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

interface DeleteRecurringButtonProps {
	recurring: RecurringTransaction;
	onDeleted: () => void | Promise<void>;
}

/** Deletes a recurring transaction, after a confirmation; its transactions stay. */
export function DeleteRecurringButton({
	recurring,
	onDeleted,
}: DeleteRecurringButtonProps) {
	const remove = useMutation({
		mutationFn: () =>
			getApi().recurring.remove(recurring.householdId, recurring.id),
		onSuccess: onDeleted,
		onError: (error) => {
			toast.error(actionErrorMessage(error));
		},
	});

	return (
		<ConfirmButton
			label={m.recurring_delete_button()}
			title={m.recurring_delete_title()}
			description={m.recurring_delete_text()}
			confirmLabel={m.recurring_delete_confirm()}
			pending={remove.isPending}
			onConfirm={() => remove.mutate()}
		/>
	);
}
