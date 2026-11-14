import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	currentHousehold,
	householdsQueryOptions,
} from "@/features/households/households-query";

// Layout of the pages that work on a household (`_household/*`): a user who
// has none yet creates or joins one first, then is brought back
export const Route = createFileRoute("/_authenticated/_household")({
	beforeLoad: async ({ context, location }) => {
		const household = currentHousehold(
			await context.queryClient.ensureQueryData(householdsQueryOptions()),
		);
		if (!household) {
			throw redirect({ to: "/setup", search: { redirect: location.href } });
		}
		return { household };
	},
});
