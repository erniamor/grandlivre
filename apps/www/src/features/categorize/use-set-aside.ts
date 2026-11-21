import type { SetAsideUndetermined } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApi } from "@/lib/api";
import { actionErrorMessage } from "@/lib/error-messages";

/**
 * Sets transactions without a tag aside as undetermined (a payee's, or
 * those before a day), says how many, and reloads the household's data.
 */
export function useSetAside(
	householdId: string,
	successMessage: (count: number) => string,
) {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: (input: SetAsideUndetermined) =>
			getApi().transactions.setAside(householdId, input),
		onSuccess: async ({ count }) => {
			toast.success(successMessage(count));
			await queryClient.invalidateQueries({
				queryKey: ["households", householdId],
			});
		},
		onError: (error) => {
			toast.error(actionErrorMessage(error));
		},
	});

	return { setAside: mutation.mutate, pending: mutation.isPending };
}
