import type { Household } from "@repo/schemas";
import { useSuspenseQuery } from "@tanstack/react-query";
import { type ReactNode, useId } from "react";
import { Amount } from "@/features/accounts/Amount";
import { accountsSummaryQueryOptions } from "@/features/accounts/accounts-query";
import { HelpHint } from "@/features/help/HelpHint";
import { m } from "@/paraglide/messages";

interface HouseholdBalanceProps {
	household: Household;
	/** Shown under the figures, e.g. a link to the accounts. */
	children?: ReactNode;
}

/**
 * The household's consolidated view over all its accounts: the net balance,
 * with what it owns and what it owes.
 */
export function HouseholdBalance({
	household,
	children,
}: HouseholdBalanceProps) {
	const { data: summary } = useSuspenseQuery(
		accountsSummaryQueryOptions(household.id),
	);
	const titleId = useId();
	const { currency } = household;

	return (
		<section
			aria-labelledby={titleId}
			className="grid gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground"
		>
			<div className="grid gap-1">
				<div className="flex items-center gap-1">
					<h2
						id={titleId}
						className="font-medium text-muted-foreground text-sm"
					>
						{m.summary_title()}
					</h2>
					<HelpHint topic="consolidatedView" />
				</div>
				<p>
					<Amount
						amount={summary.balance}
						currency={currency}
						className="font-heading font-semibold text-3xl"
					/>
				</p>
			</div>
			<dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
				<div className="grid gap-0.5">
					<dt className="text-muted-foreground">{m.summary_assets()}</dt>
					<dd>
						<Amount amount={summary.assets} currency={currency} />
					</dd>
				</div>
				<div className="grid gap-0.5">
					<dt className="text-muted-foreground">{m.summary_liabilities()}</dt>
					<dd>
						<Amount amount={summary.liabilities} currency={currency} />
					</dd>
				</div>
			</dl>
			{children}
		</section>
	);
}
