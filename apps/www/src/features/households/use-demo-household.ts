import type { HouseholdCurrency } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { browserTimeZone } from "@/features/households/time-zone-options";
import { useHouseholdChange } from "@/features/households/use-household-change";
import { getApi } from "@/lib/api";
import { actionErrorMessage } from "@/lib/error-messages";

/**
 * Makes the user a demo household (replacing theirs, if any) and opens its
 * dashboard; or deletes one, and goes back to another household, or to
 * /setup when none is left.
 */
export function useDemoHousehold() {
	const change = useHouseholdChange();
	const create = useMutation({
		mutationFn: (currency?: HouseholdCurrency) =>
			getApi().households.createDemo({ currency, timeZone: browserTimeZone() }),
		onSuccess: (household) => change.refresh("/dashboard", household.id),
		onError: (error) => {
			toast.error(actionErrorMessage(error));
		},
	});
	const remove = useMutation({
		mutationFn: (householdId: string) =>
			getApi().households.remove(householdId),
		onSuccess: () => change.refresh("/dashboard"),
		onError: (error) => {
			toast.error(actionErrorMessage(error));
		},
	});

	return {
		/** In `currency` when given, the API's default otherwise. */
		create: (currency?: HouseholdCurrency) => create.mutate(currency),
		creating: create.isPending,
		remove: (householdId: string) => remove.mutate(householdId),
		removing: remove.isPending,
	};
}
