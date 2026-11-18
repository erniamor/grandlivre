import type { Settlement } from "@repo/schemas";
import { cn } from "@repo/ui";
import { sensitiveClass } from "@/components/sensitive";
import { DeleteSettlementButton } from "@/features/sharing/DeleteSettlementButton";
import { formatDay } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface SettlementListProps {
	householdId: string;
	settlements: Settlement[];
	nameOf: (userId: string) => string;
	meId: string;
	currency: string;
}

/** The settlements, the most recent first; the two members of one can delete it. */
export function SettlementList({
	householdId,
	settlements,
	nameOf,
	meId,
	currency,
}: SettlementListProps) {
	const locale = getLocale();
	if (settlements.length === 0) {
		return <p className="text-muted-foreground">{m.settlements_empty()}</p>;
	}

	return (
		<ul className="grid gap-2">
			{settlements.map((settlement) => {
				const sentence = m.settlement_paid({
					from: nameOf(settlement.fromUserId),
					to: nameOf(settlement.toUserId),
					amount: formatAmount(settlement.amount, currency, locale),
				});
				return (
					<li
						key={settlement.id}
						className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-4 text-card-foreground"
					>
						<div className="grid gap-0.5">
							<span className={cn("font-medium", sensitiveClass)}>
								{sentence}
							</span>
							<span className="text-muted-foreground text-sm">
								{[
									formatDay(settlement.date, locale),
									settlement.transactionId
										? m.settlement_with_transfer()
										: m.settlement_outside(),
									settlement.note,
								]
									.filter(Boolean)
									.join(" · ")}
							</span>
						</div>
						{(settlement.fromUserId === meId ||
							settlement.toUserId === meId) && (
							<DeleteSettlementButton
								householdId={householdId}
								settlement={settlement}
								name={sentence}
							/>
						)}
					</li>
				);
			})}
		</ul>
	);
}
