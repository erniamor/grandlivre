import type { Household } from "@repo/schemas";
import { cn } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { cardClass } from "@/components/card-styles";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { OccurrenceItem } from "@/features/recurring/OccurrenceItem";
import {
	UPCOMING_DAYS,
	upcomingQueryOptions,
} from "@/features/recurring/recurring-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { m } from "@/paraglide/messages";

interface UpcomingRecurringProps {
	household: Household;
}

const modeLabels = {
	automatic: m.recurring_mode_automatic,
	confirm: m.recurring_mode_confirm,
};

/**
 * The next days of the recurring transactions, over the coming weeks, with
 * a link to all of them. Nothing shows when none comes.
 */
export function UpcomingRecurring({ household }: UpcomingRecurringProps) {
	const { data: upcoming } = useSuspenseQuery(
		upcomingQueryOptions(household.id),
	);
	const { data: accounts } = useSuspenseQuery(
		accountsQueryOptions(household.id),
	);
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const titleId = useId();

	if (upcoming.items.length === 0) {
		return null;
	}

	return (
		<section aria-labelledby={titleId} className={cn("grid gap-3", cardClass)}>
			<h2 id={titleId} className="font-heading font-semibold text-lg">
				{m.upcoming_recurring_title({ days: UPCOMING_DAYS })}
			</h2>
			<ul className="grid gap-2">
				{upcoming.items.map(({ date, recurring }) => (
					<OccurrenceItem
						key={`${recurring.id}-${date}`}
						date={date}
						recurring={recurring}
						accounts={accounts.items}
						tags={tags}
						currency={household.currency}
						status={modeLabels[recurring.mode]()}
					/>
				))}
			</ul>
			{upcoming.total > upcoming.items.length && (
				<p className="text-muted-foreground text-sm">
					{m.upcoming_recurring_more({
						count: upcoming.total - upcoming.items.length,
					})}
				</p>
			)}
			<Link
				to="/recurring"
				className="justify-self-start rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
			>
				{m.upcoming_recurring_link()}
			</Link>
		</section>
	);
}
