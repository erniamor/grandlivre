import type { Period } from "@/features/reports/period";
import { ReportRow } from "@/features/reports/ReportRow";
import { TagTransactionsLink } from "@/features/reports/TagTransactionsLink";
import type { Untagged } from "@/features/transactions/transaction-filters";
import { m } from "@/paraglide/messages";

interface UntaggedReportItemProps {
	/** Still to categorize, or set aside as undetermined. */
	untagged: Untagged;
	/** In minor units, positive. */
	amount: number;
	/** The section's total, for its share. */
	total: number;
	currency: string;
	period: Period;
}

/** A report's lines without a tag, linking to their transactions over the period. */
export function UntaggedReportItem({
	untagged,
	amount,
	total,
	currency,
	period,
}: UntaggedReportItemProps) {
	const name =
		untagged === "undetermined"
			? m.transaction_undetermined()
			: m.transaction_uncategorized();

	return (
		<li className="flex items-start gap-2 py-2 pl-6">
			<ReportRow
				name={name}
				amount={amount}
				share={amount / total}
				currency={currency}
			/>
			<TagTransactionsLink filter={{ untagged }} name={name} period={period} />
		</li>
	);
}
