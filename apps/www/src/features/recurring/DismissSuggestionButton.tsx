import type { RecurringSuggestion } from "@repo/schemas";
import { Button, toast } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { suggestionKeyOf } from "@/features/recurring/recurring-suggestion";
import { useRecurringChange } from "@/features/recurring/use-recurring-change";
import { getApi } from "@/lib/api";
import { actionErrorMessage } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

interface DismissSuggestionButtonProps {
	householdId: string;
	suggestion: RecurringSuggestion;
	/** What is dismissed, named in the button's accessible name. */
	title: string;
}

/** Says a series found in the history doesn't repeat: it is no longer suggested. */
export function DismissSuggestionButton({
	householdId,
	suggestion,
	title,
}: DismissSuggestionButtonProps) {
	const refresh = useRecurringChange(householdId);
	const dismiss = useMutation({
		mutationFn: () =>
			getApi().recurring.dismiss(householdId, suggestionKeyOf(suggestion)),
		onSuccess: async () => {
			toast.success(m.toast_suggestion_dismissed());
			await refresh();
		},
		onError: (error) => {
			toast.error(actionErrorMessage(error));
		},
	});

	return (
		<Button
			type="button"
			variant="ghost"
			aria-label={m.recurring_suggestion_dismiss_label({ name: title })}
			disabled={dismiss.isPending}
			onClick={() => dismiss.mutate()}
		>
			{m.recurring_suggestion_dismiss_button()}
		</Button>
	);
}
