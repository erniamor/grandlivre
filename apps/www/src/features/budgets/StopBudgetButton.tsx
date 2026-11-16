import { toast } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { ConfirmButton } from "@/components/ConfirmButton";
import { monthLabel } from "@/features/reports/month-label";
import { getApi } from "@/lib/api";
import { actionErrorMessage } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface StopBudgetButtonProps {
	householdId: string;
	tagId: string;
	/** The first month without the budget. */
	from: string;
	onStopped: () => void | Promise<void>;
}

/** Stops a budget from a month on, after a confirmation; the months before keep it. */
export function StopBudgetButton({
	householdId,
	tagId,
	from,
	onStopped,
}: StopBudgetButtonProps) {
	const stop = useMutation({
		mutationFn: () => getApi().budgets.stop(householdId, tagId, from),
		onSuccess: onStopped,
		onError: (error) => {
			toast.error(actionErrorMessage(error));
		},
	});

	return (
		<ConfirmButton
			label={m.budget_stop_button()}
			title={m.budget_stop_title()}
			description={m.budget_stop_text({
				month: monthLabel(from, getLocale(), "long"),
			})}
			confirmLabel={m.budget_stop_confirm()}
			pending={stop.isPending}
			onConfirm={() => stop.mutate()}
		/>
	);
}
