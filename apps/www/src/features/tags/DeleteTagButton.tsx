import { toast } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { ConfirmButton } from "@/components/ConfirmButton";
import { getApi } from "@/lib/api";
import { actionErrorMessage } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

interface DeleteTagButtonProps {
	householdId: string;
	tagId: string;
	/** The tag's name for the user. */
	name: string;
	onDeleted: () => void | Promise<void>;
}

/** Deletes a tag, after a confirmation; a refusal is said in a toast. */
export function DeleteTagButton({
	householdId,
	tagId,
	name,
	onDeleted,
}: DeleteTagButtonProps) {
	const remove = useMutation({
		mutationFn: () => getApi().tags.remove(householdId, tagId),
		onSuccess: onDeleted,
		onError: (error) => {
			toast.error(actionErrorMessage(error));
		},
	});

	return (
		<ConfirmButton
			label={m.tag_delete_button()}
			title={m.tag_delete_title({ name })}
			description={m.tag_delete_text()}
			confirmLabel={m.tag_delete_confirm()}
			pending={remove.isPending}
			onConfirm={() => remove.mutate()}
		/>
	);
}
