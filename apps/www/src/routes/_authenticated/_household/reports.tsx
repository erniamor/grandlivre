import { calendarDateSchema } from "@repo/schemas";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { isPeriod, monthOf } from "@/features/reports/period";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { tagReportQueryOptions } from "@/features/reports/reports-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { localToday } from "@/features/transactions/use-local-today";

// The period shown; anything invalid is dropped, for the current month
const searchSchema = z.object({
	from: calendarDateSchema.optional().catch(undefined),
	to: calendarDateSchema.optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/_household/reports")({
	validateSearch: searchSchema,
	beforeLoad: ({ search }) => {
		// No period, or a wrong one: the current month, written in the address
		// so it can be shared. On the server, the month is the server's.
		if (!search.from || !search.to || !isPeriod(search.from, search.to)) {
			throw redirect({ to: "/reports", search: monthOf(localToday()) });
		}
	},
	loaderDeps: ({ search }) => ({
		from: search.from ?? "",
		to: search.to ?? "",
	}),
	loader: ({ context, deps }) => {
		const { household, queryClient } = context;
		return Promise.all([
			queryClient.ensureQueryData(tagReportQueryOptions(household.id, deps)),
			queryClient.ensureQueryData(tagsQueryOptions(household.id)),
		]);
	},
	component: ReportsRoute,
});

function ReportsRoute() {
	const { household } = Route.useRouteContext();
	const period = Route.useLoaderDeps();
	const navigate = useNavigate();

	return (
		<ReportsPage
			household={household}
			period={period}
			onPeriodChange={(next) => navigate({ to: "/reports", search: next })}
		/>
	);
}
