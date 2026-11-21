import { buttonVariants } from "@repo/ui";
import { Link } from "@tanstack/react-router";
import { ListIcon } from "lucide-react";
import { WithTooltip } from "@/components/WithTooltip";
import type { Period } from "@/features/reports/period";
import type { Untagged } from "@/features/transactions/transaction-filters";
import { m } from "@/paraglide/messages";

interface TagTransactionsLinkProps {
	/**
	 * A tag, and the tags under it; or the lines without a tag, still to
	 * categorize or set aside as undetermined.
	 */
	filter: { tag: string } | { untagged: Untagged };
	/** The tag's name, or the lines', for screen readers. */
	name: string;
	period: Period;
}

/** Opens the transactions of a report's line over a period. */
export function TagTransactionsLink({
	filter,
	name,
	period,
}: TagTransactionsLinkProps) {
	return (
		<WithTooltip label={m.report_tag_transactions_tooltip()}>
			<Link
				to="/transactions"
				search={{ ...filter, from: period.from, to: period.to }}
				aria-label={m.report_tag_transactions_label({ name })}
				className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
			>
				<ListIcon aria-hidden className="size-4" />
			</Link>
		</WithTooltip>
	);
}
