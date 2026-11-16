import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { ImportPage } from "@/features/imports/ImportPage";
import { importsQueryOptions } from "@/features/imports/imports-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";

const importSearchSchema = z.object({
	/** The account the page was opened from. */
	accountId: z.uuid().optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/_household/import")({
	validateSearch: importSearchSchema,
	loader: async ({ context }) => {
		const { household, queryClient } = context;
		await Promise.all([
			queryClient.ensureQueryData(accountsQueryOptions(household.id)),
			queryClient.ensureQueryData(tagsQueryOptions(household.id)),
			queryClient.ensureQueryData(importsQueryOptions(household.id)),
		]);
	},
	component: ImportRoute,
});

function ImportRoute() {
	const { household } = Route.useRouteContext();
	const { accountId } = Route.useSearch();

	return <ImportPage household={household} fromAccountId={accountId} />;
}
