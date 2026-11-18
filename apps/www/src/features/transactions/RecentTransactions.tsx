import type { Household } from "@repo/schemas";
import { buttonVariants, cn } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useId } from "react";
import { cardClass } from "@/components/card-styles";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { TransactionItem } from "@/features/transactions/TransactionItem";
import { transactionsQueryOptions } from "@/features/transactions/transactions-query";
import { m } from "@/paraglide/messages";

export const RECENT_TRANSACTIONS_COUNT = 5;

interface RecentTransactionsProps {
	household: Household;
}

/** The last transactions of the household, with a link to all of them. */
export function RecentTransactions({ household }: RecentTransactionsProps) {
	const { data: transactions } = useSuspenseQuery(
		transactionsQueryOptions(household.id, {
			pageSize: RECENT_TRANSACTIONS_COUNT,
		}),
	);
	const { data: accounts } = useSuspenseQuery(
		accountsQueryOptions(household.id),
	);
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const titleId = useId();

	return (
		<section aria-labelledby={titleId} className={cn("grid gap-3", cardClass)}>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 id={titleId} className="font-heading font-semibold text-lg">
					{m.recent_transactions_title()}
				</h2>
				<Link to="/transactions/new" className={buttonVariants({ size: "sm" })}>
					<PlusIcon aria-hidden />
					{m.transaction_add_button()}
				</Link>
			</div>
			{transactions.items.length === 0 ? (
				<p className="text-muted-foreground">{m.transactions_empty()}</p>
			) : (
				<ul className="grid gap-2">
					{transactions.items.map((transaction) => (
						<TransactionItem
							key={transaction.id}
							transaction={transaction}
							accounts={accounts.items}
							tags={tags}
							currency={household.currency}
							linked
						/>
					))}
				</ul>
			)}
			<Link
				to="/transactions"
				className="justify-self-start rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
			>
				{m.recent_transactions_link()}
			</Link>
		</section>
	);
}
