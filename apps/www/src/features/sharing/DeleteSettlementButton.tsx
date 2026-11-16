import type { Settlement } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useSharingChange } from "@/features/sharing/use-sharing-change";
import { useTransactionChange } from "@/features/transactions/use-transaction-change";
import { getApi } from "@/lib/api";
import { actionErrorMessage } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

interface DeleteSettlementButtonProps {
	householdId: string;
	settlement: Settlement;
	/** What the settlement is, in words, for the button's accessible name. */
	name: string;
}

/** Deletes a settlement after a confirmation, with its transfer. */
export function DeleteSettlementButton({
	householdId,
	settlement,
	name,
}: DeleteSettlementButtonProps) {
	const refreshSharing = useSharingChange(householdId);
	const refreshTransactions = useTransactionChange(householdId);
	const remove = useMutation({
		mutationFn: () =>
			getApi().sharing.removeSettlement(householdId, settlement.id),
		onSuccess: async () => {
			toast.success(m.toast_settlement_deleted());
			await Promise.all([refreshSharing(), refreshTransactions()]);
		},
		onError: (error) => {
			toast.error(actionErrorMessage(error));
		},
	});

	return (
		<ConfirmButton
			label={m.settlement_delete_button()}
			ariaLabel={m.settlement_delete_label({ name })}
			icon={Trash2Icon}
			title={m.settlement_delete_title()}
			description={
				settlement.transactionId
					? m.settlement_delete_text_transfer()
					: m.settlement_delete_text()
			}
			confirmLabel={m.settlement_delete_confirm()}
			pending={remove.isPending}
			onConfirm={() => remove.mutate()}
		/>
	);
}
