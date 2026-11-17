import { Button } from "@repo/ui";
import { SparklesIcon } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { m } from "@/paraglide/messages";

interface TagSuggestionsBarProps {
	/** How many payees shown the assistant wasn't asked about yet. */
	remaining: number;
	/** How many it was asked about. */
	askedCount: number;
	suggesting: boolean;
	onSuggest: () => void;
	/** The payees a tag shows for, and their transactions. */
	toApply: { payees: number; transactions: number };
	applying: boolean;
	onApply: () => void;
}

/**
 * Asks the assistant for the payees' tags, a page's worth at a time, then
 * applies every tag shown at once, after a confirmation.
 */
export function TagSuggestionsBar({
	remaining,
	askedCount,
	suggesting,
	onSuggest,
	toApply,
	applying,
	onApply,
}: TagSuggestionsBarProps) {
	return (
		<div className="grid gap-2 rounded-lg border border-border bg-muted/40 p-4">
			<p className="text-muted-foreground text-sm">
				{m.categorize_suggest_intro()}
			</p>
			<div className="flex flex-wrap items-center gap-2">
				{remaining > 0 && (
					<Button
						type="button"
						variant="outline"
						disabled={suggesting}
						onClick={onSuggest}
					>
						<SparklesIcon aria-hidden />
						{suggesting
							? m.categorize_suggest_pending()
							: askedCount === 0
								? m.categorize_suggest_button()
								: m.categorize_suggest_more_button()}
					</Button>
				)}
				{askedCount > 0 && toApply.payees > 0 && (
					<ConfirmButton
						label={m.categorize_apply_all_button({ count: toApply.payees })}
						title={m.categorize_apply_all_title()}
						description={m.categorize_apply_all_text({
							payees: toApply.payees,
							count: toApply.transactions,
						})}
						confirmLabel={m.categorize_apply_all_confirm()}
						pending={applying}
						onConfirm={onApply}
					/>
				)}
			</div>
		</div>
	);
}
