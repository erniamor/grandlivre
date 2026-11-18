import type { Household } from "@repo/schemas";
import { cn } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { cardClass } from "@/components/card-styles";
import { sharingOverviewQueryOptions } from "@/features/sharing/sharing-query";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface SharingSummaryProps {
	/** A household that settles shared expenses. */
	household: Household;
	meId: string;
}

/** What the user owes, or is owed, with a link to settle. */
export function SharingSummary({ household, meId }: SharingSummaryProps) {
	const { data } = useSuspenseQuery(sharingOverviewQueryOptions(household.id));
	const titleId = useId();
	const locale = getLocale();
	const names = new Map(
		data.balances.map(({ userId, name }) => [userId, name]),
	);
	const nameOf = (userId: string) =>
		names.get(userId) ?? m.sharing_former_member();
	const mine = data.suggestions.filter(
		(each) => each.fromUserId === meId || each.toUserId === meId,
	);

	return (
		<section aria-labelledby={titleId} className={cn("grid gap-2", cardClass)}>
			<h2 id={titleId} className="font-heading font-semibold text-lg">
				{m.sharing_title()}
			</h2>
			{mine.length === 0 ? (
				<p className="text-muted-foreground">{m.sharing_you_are_even()}</p>
			) : (
				<ul className="grid gap-1">
					{mine.map(({ fromUserId, toUserId, amount }) => {
						const money = formatAmount(amount, household.currency, locale);
						return (
							<li key={`${fromUserId}-${toUserId}`}>
								{fromUserId === meId
									? m.sharing_you_owe({ name: nameOf(toUserId), amount: money })
									: m.sharing_owes_you({
											name: nameOf(fromUserId),
											amount: money,
										})}
							</li>
						);
					})}
				</ul>
			)}
			<Link
				to="/shared"
				className="justify-self-start rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
			>
				{m.sharing_summary_link()}
			</Link>
		</section>
	);
}
