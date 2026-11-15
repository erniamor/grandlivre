import type { Household, UpdateHousehold } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { householdsQueryOptions } from "@/features/households/households-query";
import { getApi } from "@/lib/api";
import { actionErrorMessage } from "@/lib/error-messages";

/**
 * Changes the name, the currency or the time zone of a household, then refreshes what the
 * routes hold of it. A refused change is said in a toast.
 */
export function useUpdateHousehold(household: Household) {
	const queryClient = useQueryClient();
	const router = useRouter();

	return useMutation({
		mutationFn: (input: UpdateHousehold) =>
			getApi().households.update(household.id, input),
		onSuccess: async (updated) => {
			queryClient.setQueryData(
				householdsQueryOptions().queryKey,
				(households) =>
					households && {
						...households,
						items: households.items.map((item) =>
							item.id === updated.id ? updated : item,
						),
					},
			);
			// The pages read the household from the route context
			await router.invalidate();
		},
		onError: (error) => {
			toast.error(actionErrorMessage(error));
		},
	});
}
