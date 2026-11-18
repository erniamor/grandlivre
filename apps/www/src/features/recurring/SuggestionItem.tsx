import type { Account, RecurringSuggestion, Tag } from "@repo/schemas";
import { buttonVariants, cn } from "@repo/ui";
import { Link } from "@tanstack/react-router";
import { sensitiveClass } from "@/components/sensitive";
import { DismissSuggestionButton } from "@/features/recurring/DismissSuggestionButton";
import {
	suggestionId,
	templateOfSuggestion,
} from "@/features/recurring/recurring-suggestion";
import {
	templateDirection,
	templateTitle,
	templateWhere,
} from "@/features/recurring/recurring-view";
import { scheduleLabel } from "@/features/recurring/schedule-label";
import { formatDay } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface SuggestionItemProps {
	householdId: string;
	suggestion: RecurringSuggestion;
	accounts: Account[];
	tags: Tag[];
	currency: string;
}

/**
 * A series found in the history: what it records, how often, when next,
 * how often it was seen; to make a recurring transaction of, or dismiss.
 */
export function SuggestionItem({
	householdId,
	suggestion,
	accounts,
	tags,
	currency,
}: SuggestionItemProps) {
	const locale = getLocale();
	const template = templateOfSuggestion(suggestion);
	const title = templateTitle(template);
	const direction = templateDirection(template);
	const money = (amount: number) =>
		formatAmount(amount * (direction || 1), currency, locale, {
			signed: direction !== 0,
		});
	const lastDate = suggestion.dates.at(-1);
	const varies = suggestion.minAmount !== suggestion.maxAmount;

	return (
		<li className="grid gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
			<div className="flex flex-wrap items-start gap-x-4 gap-y-1">
				<div className="grid min-w-40 flex-1 gap-0.5">
					<p className={cn("break-words font-medium", sensitiveClass)}>
						{title}
					</p>
					<p className="break-words text-muted-foreground text-sm">
						{templateWhere(template, accounts, tags, locale)}
					</p>
					<p className="break-words text-muted-foreground text-sm">
						{[
							scheduleLabel(suggestion),
							m.recurring_next({
								date: formatDay(suggestion.nextDate, locale),
							}),
						].join(" · ")}
					</p>
					{lastDate && (
						<p className="break-words text-muted-foreground text-sm">
							{m.recurring_suggestion_seen({
								count: suggestion.count,
								date: formatDay(lastDate, locale),
							})}
						</p>
					)}
				</div>
				<div className="grid justify-items-end gap-0.5">
					<span
						className={cn(
							sensitiveClass,
							"whitespace-nowrap font-medium tabular-nums",
							direction === 1 && "text-primary",
							direction === 0 && "text-muted-foreground",
						)}
					>
						{money(suggestion.amount)}
					</span>
					{varies && (
						<span
							className={cn(
								"whitespace-nowrap text-muted-foreground text-sm tabular-nums",
								sensitiveClass,
							)}
						>
							{m.recurring_suggestion_range({
								min: formatAmount(suggestion.minAmount, currency, locale),
								max: formatAmount(suggestion.maxAmount, currency, locale),
							})}
						</span>
					)}
				</div>
			</div>
			<div className="flex flex-wrap gap-2">
				<Link
					to="/recurring/new"
					search={{ suggestion: suggestionId(suggestion) }}
					aria-label={m.recurring_suggestion_create_label({ name: title })}
					className={buttonVariants({ variant: "outline" })}
				>
					{m.recurring_suggestion_create_button()}
				</Link>
				<DismissSuggestionButton
					householdId={householdId}
					suggestion={suggestion}
					title={title}
				/>
			</div>
		</li>
	);
}
