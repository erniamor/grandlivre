import { Button, toast } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { SparklesIcon } from "lucide-react";
import { getApi } from "@/lib/api";
import { actionErrorMessage } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

interface SuggestedTagsButtonProps {
	householdId: string;
	onAdded: () => void | Promise<void>;
}

/** Adds a starting set of tags, named in every language. */
export function SuggestedTagsButton({
	householdId,
	onAdded,
}: SuggestedTagsButtonProps) {
	const add = useMutation({
		mutationFn: () => getApi().tags.addSuggested(householdId),
		onSuccess: onAdded,
		onError: (error) => {
			toast.error(actionErrorMessage(error));
		},
	});

	return (
		<Button
			type="button"
			variant="outline"
			disabled={add.isPending}
			onClick={() => add.mutate()}
		>
			<SparklesIcon aria-hidden />
			{m.tags_add_suggested_button()}
		</Button>
	);
}
