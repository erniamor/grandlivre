import type { SettlementSuggestion } from "@repo/schemas";
import { buttonVariants } from "@repo/ui";
import { Link } from "@tanstack/react-router";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface SuggestionListProps {
	suggestions: SettlementSuggestion[];
	nameOf: (userId: string) => string;
	meId: string;
	currency: string;
}

/**
 * The fewest payments that settle everything; the ones the user makes or
 * receives can be recorded from here.
 */
export function SuggestionList({
	suggestions,
	nameOf,
	meId,
	currency,
}: SuggestionListProps) {
	const locale = getLocale();
	if (suggestions.length === 0) {
		return <p className="text-muted-foreground">{m.sharing_all_even()}</p>;
	}

	return (
		<ul className="grid gap-2">
			{suggestions.map(({ fromUserId, toUserId, amount }) => {
				const sentence = m.sharing_pays({
					from: nameOf(fromUserId),
					to: nameOf(toUserId),
					amount: formatAmount(amount, currency, locale),
				});
				return (
					<li
						key={`${fromUserId}-${toUserId}`}
						className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted p-3"
					>
						<span>{sentence}</span>
						{(fromUserId === meId || toUserId === meId) && (
							<Link
								to="/shared/settle"
								search={{ from: fromUserId, to: toUserId, amount }}
								aria-label={m.sharing_settle_label({ payment: sentence })}
								className={buttonVariants({ size: "sm" })}
							>
								{m.sharing_settle_button()}
							</Link>
						)}
					</li>
				);
			})}
		</ul>
	);
}
