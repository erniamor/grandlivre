import type { Account, Tag, Transaction } from "@repo/schemas";
import { cn } from "@repo/ui";
import {
	transactionDirection,
	transactionTagNames,
} from "@/features/transactions/transaction-view";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface TransactionItemProps {
	transaction: Transaction;
	accounts: Account[];
	tags: Tag[];
	currency: string;
	/** The account the list is about: a transfer then leaves it or enters it. */
	accountId?: string;
}

const typeLabels = {
	expense: m.transaction_type_expense,
	income: m.transaction_type_income,
	transfer: m.transaction_type_transfer,
};

/** One transaction: who or what, where, its categories and its amount. */
export function TransactionItem({
	transaction,
	accounts,
	tags,
	currency,
	accountId,
}: TransactionItemProps) {
	const locale = getLocale();
	const nameOf = (id: string | null) =>
		accounts.find((account) => account.id === id)?.name ??
		m.transaction_unknown_account();
	const direction = transactionDirection(transaction, accountId);
	const isTransfer = transaction.type === "transfer";
	const tagNames = transactionTagNames(transaction, tags, locale).map(
		(name) => name ?? m.transaction_uncategorized(),
	);
	const details = isTransfer
		? [
				m.transaction_transfer_accounts({
					from: nameOf(transaction.accountId),
					to: nameOf(transaction.toAccountId),
				}),
			]
		: [...tagNames, nameOf(transaction.accountId)];

	return (
		<li className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-card p-4 text-card-foreground">
			<div className="grid min-w-40 flex-1 gap-0.5">
				<p className="break-words font-medium">
					{transaction.payee ?? typeLabels[transaction.type]()}
				</p>
				<p className="break-words text-muted-foreground text-sm">
					{details.join(" · ")}
				</p>
				{transaction.note && (
					<p className="break-words text-muted-foreground text-sm">
						{transaction.note}
					</p>
				)}
			</div>
			<span
				className={cn(
					"whitespace-nowrap font-medium tabular-nums",
					// Money coming in stands out; a transfer between accounts doesn't
					direction === 1 && "text-primary",
					direction === 0 && "text-muted-foreground",
				)}
			>
				{formatAmount(transaction.amount * (direction || 1), currency, locale, {
					signed: direction !== 0,
				})}
			</span>
		</li>
	);
}
