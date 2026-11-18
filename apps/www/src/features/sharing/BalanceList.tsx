import type { SharingBalance } from "@repo/schemas";
import { cn } from "@repo/ui";
import { sensitiveClass } from "@/components/sensitive";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface BalanceListProps {
	balances: SharingBalance[];
	meId: string;
	currency: string;
}

/** Where each member stands: owed, owing, or even. */
export function BalanceList({ balances, meId, currency }: BalanceListProps) {
	const locale = getLocale();
	const money = (amount: number) => formatAmount(amount, currency, locale);

	return (
		<ul className="grid gap-2">
			{balances.map(({ userId, name, isMember, balance }) => (
				<li
					key={userId}
					className="flex flex-wrap items-baseline justify-between gap-x-4 rounded-lg border border-border bg-card p-4 text-card-foreground"
				>
					<span className="font-medium">
						{userId === meId ? m.sharing_you({ name }) : name}
						{!isMember && (
							<span className="ml-2 font-normal text-muted-foreground text-sm">
								{m.sharing_former_member()}
							</span>
						)}
					</span>
					<span
						className={cn(
							"tabular-nums",
							sensitiveClass,
							balance > 0 && "text-primary",
							balance === 0 && "text-muted-foreground",
						)}
					>
						{balance > 0
							? m.sharing_is_owed({ amount: money(balance) })
							: balance < 0
								? m.sharing_owes({ amount: money(-balance) })
								: m.sharing_even()}
					</span>
				</li>
			))}
		</ul>
	);
}
