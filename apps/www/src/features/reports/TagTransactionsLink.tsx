import { buttonVariants } from "@repo/ui";
import { Link } from "@tanstack/react-router";
import { ListIcon } from "lucide-react";
import { WithTooltip } from "@/components/WithTooltip";
import type { Period } from "@/features/reports/period";
import { m } from "@/paraglide/messages";

interface TagTransactionsLinkProps {
	tagId: string;
	/** The tag's name, for screen readers. */
	name: string;
	period: Period;
}

/** Opens the transactions of a tag, and of the tags under it, over a period. */
export function TagTransactionsLink({
	tagId,
	name,
	period,
}: TagTransactionsLinkProps) {
	return (
		<WithTooltip label={m.report_tag_transactions_tooltip()}>
			<Link
				to="/transactions"
				search={{ tag: tagId, from: period.from, to: period.to }}
				aria-label={m.report_tag_transactions_label({ name })}
				className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
			>
				<ListIcon aria-hidden className="size-4" />
			</Link>
		</WithTooltip>
	);
}
