import { useQueryClient } from "@tanstack/react-query";
import { sharingQueryKey } from "@/features/sharing/sharing-query";

/** Reloads where the household's members stand, after a change. */
export function useSharingChange(householdId: string) {
	const queryClient = useQueryClient();

	return () =>
		queryClient.invalidateQueries({ queryKey: sharingQueryKey(householdId) });
}
