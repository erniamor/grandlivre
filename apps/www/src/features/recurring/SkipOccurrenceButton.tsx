import { toast } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useRecurringChange } from "@/features/recurring/use-recurring-change";
import { getApi } from "@/lib/api";
import { formatDay } from "@/lib/dates";
import { actionErrorMessage } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface SkipOccurrenceButtonProps {
	householdId: string;
	occurrenceId: string;
	/** The day skipped, named in the confirmation. */
	date: string;
	/** What is skipped, named in the button's accessible name. */
	title: string;
	onSkipped?: () => void | Promise<void>;
}

/** Skips a waiting day, after a confirmation: nothing is recorded for it. */
export function SkipOccurrenceButton({
	householdId,
	occurrenceId,
	date,
	title,
	onSkipped,
}: SkipOccurrenceButtonProps) {
	const refresh = useRecurringChange(householdId);
	const skip = useMutation({
		mutationFn: () => getApi().recurring.skip(householdId, occurrenceId),
		onSuccess: async () => {
			await onSkipped?.();
			toast.success(m.toast_occurrence_skipped());
			await refresh();
		},
		onError: (error) => {
			toast.error(actionErrorMessage(error));
		},
	});

	return (
		<ConfirmButton
			label={m.occurrence_skip_button()}
			ariaLabel={m.occurrence_skip_label({ name: title })}
			title={m.occurrence_skip_title()}
			description={m.occurrence_skip_text({
				date: formatDay(date, getLocale()),
			})}
			confirmLabel={m.occurrence_skip_confirm()}
			pending={skip.isPending}
			onConfirm={() => skip.mutate()}
		/>
	);
}
