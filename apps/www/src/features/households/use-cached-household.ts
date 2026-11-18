import { useQuery } from "@tanstack/react-query";
import {
	currentHousehold,
	householdsQueryOptions,
} from "@/features/households/households-query";

/**
 * The current household, from the households the pages loaded: no request
 * of its own, null until they are loaded (or for a user without any). For
 * what sits outside the household's pages, as the navigation.
 */
export function useCachedHousehold(preferredHousehold: string | undefined) {
	const { data: households } = useQuery({
		...householdsQueryOptions(),
		enabled: false,
	});
	return households ? currentHousehold(households, preferredHousehold) : null;
}
