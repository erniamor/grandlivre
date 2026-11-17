import { useRouter } from "@tanstack/react-router";
import { rememberHousehold } from "@/features/households/preferred-household";

/** Where the app opens on a household switched to. */
const SWITCHED_TARGET = "/dashboard";

/**
 * Works on another of the user's households from now on, on this device:
 * remembers it, re-runs the routes (which read the household from their
 * context) and opens its dashboard. Its data has its own queries, by its
 * id: nothing of the other household shows.
 */
export function useSwitchHousehold() {
	const router = useRouter();

	return async (householdId: string) => {
		rememberHousehold(householdId);
		await router.invalidate();
		await router.navigate({ to: SWITCHED_TARGET });
	};
}
