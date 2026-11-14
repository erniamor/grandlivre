import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { householdsQueryOptions } from "@/features/households/households-query";

/**
 * After creating or joining a household: reloads the user's households,
 * re-runs the routes' checks (redirects, route context) and opens `href`.
 */
export function useHouseholdChange() {
	const queryClient = useQueryClient();
	const router = useRouter();

	return {
		async refresh(href: string) {
			await queryClient.fetchQuery({
				...householdsQueryOptions(),
				staleTime: 0,
			});
			await router.invalidate();
			await router.navigate({ href });
		},
	};
}
