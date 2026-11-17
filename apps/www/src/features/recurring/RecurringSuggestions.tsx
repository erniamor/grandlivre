import type { Account, RecurringSuggestion, Tag } from "@repo/schemas";
import { suggestionId } from "@/features/recurring/recurring-suggestion";
import { SuggestionItem } from "@/features/recurring/SuggestionItem";
import { m } from "@/paraglide/messages";

interface RecurringSuggestionsProps {
	householdId: string;
	suggestions: RecurringSuggestion[];
	accounts: Account[];
	tags: Tag[];
	currency: string;
}

/** The series found in the history of the user's accounts; nothing when none. */
export function RecurringSuggestions({
	householdId,
	suggestions,
	accounts,
	tags,
	currency,
}: RecurringSuggestionsProps) {
	if (suggestions.length === 0) {
		return null;
	}
	return (
		<section aria-labelledby="recurring-suggestions" className="grid gap-3">
			<header className="grid gap-1">
				<h2
					id="recurring-suggestions"
					className="font-heading font-semibold text-lg"
				>
					{m.recurring_suggestions_title()}
				</h2>
				<p className="text-muted-foreground text-sm">
					{m.recurring_suggestions_intro()}
				</p>
			</header>
			<ul className="grid gap-2">
				{suggestions.map((suggestion) => (
					<SuggestionItem
						key={suggestionId(suggestion)}
						householdId={householdId}
						suggestion={suggestion}
						accounts={accounts}
						tags={tags}
						currency={currency}
					/>
				))}
			</ul>
		</section>
	);
}
