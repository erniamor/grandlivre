import type { UncategorizedPayee } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApi } from "@/lib/api";
import { actionErrorMessage } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

/**
 * Applies a tag to each payee's transactions without one, one payee after
 * the other; stops at the first that fails, those before it applied.
 */
export function useApplyTags(householdId: string) {
	const queryClient = useQueryClient();
	const reload = () =>
		queryClient.invalidateQueries({ queryKey: ["households", householdId] });

	const apply = useMutation({
		mutationFn: async (
			tagged: { group: UncategorizedPayee; tagId: string }[],
		) => {
			let count = 0;
			for (const { group, tagId } of tagged) {
				const result = await getApi().transactions.categorize(householdId, {
					key: group.key,
					type: group.type,
					tagId,
				});
				count += result.count;
			}
			return count;
		},
		onSuccess: async (count) => {
			toast.success(m.toast_tags_applied({ count }));
			await reload();
		},
		onError: async (error) => {
			toast.error(actionErrorMessage(error));
			// Some payees may have taken their tag before it failed
			await reload();
		},
	});

	return {
		apply: apply.mutate,
		pending: apply.isPending,
	};
}
