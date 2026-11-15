import type { Account, Tag, Transaction } from "@repo/schemas";
import { TransactionItem } from "@/features/transactions/TransactionItem";
import { groupByDay } from "@/features/transactions/transaction-view";
import { formatDay } from "@/lib/dates";
import { getLocale } from "@/paraglide/runtime";

interface TransactionListProps {
	/** Sorted by day, as the API returns them. */
	transactions: Transaction[];
	accounts: Account[];
	tags: Tag[];
	currency: string;
	/** The account the list is about, if any. */
	accountId?: string;
}

/** Transactions grouped under their day, written in words. */
export function TransactionList({
	transactions,
	accounts,
	tags,
	currency,
	accountId,
}: TransactionListProps) {
	const locale = getLocale();

	return (
		<div className="grid gap-6">
			{groupByDay(transactions).map(({ day, transactions: ofDay }) => (
				<section
					key={day}
					aria-label={formatDay(day, locale)}
					className="grid gap-2"
				>
					<h2 className="font-medium text-muted-foreground text-sm first-letter:uppercase">
						{formatDay(day, locale)}
					</h2>
					<ul className="grid gap-2">
						{ofDay.map((transaction) => (
							<TransactionItem
								key={transaction.id}
								transaction={transaction}
								accounts={accounts}
								tags={tags}
								currency={currency}
								accountId={accountId}
							/>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}
