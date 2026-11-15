import type { Household } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { DeleteTransactionButton } from "@/features/transactions/DeleteTransactionButton";
import { TransactionForm } from "@/features/transactions/TransactionForm";
import { TransactionList } from "@/features/transactions/TransactionList";
import { TransactionsBackLink } from "@/features/transactions/TransactionsBackLink";
import { canEditTransaction } from "@/features/transactions/transaction-form";
import { transactionQueryOptions } from "@/features/transactions/transactions-query";
import { useTransactionChange } from "@/features/transactions/use-transaction-change";
import { getApi } from "@/lib/api";
import { m } from "@/paraglide/messages";

interface EditTransactionPageProps {
	household: Household;
	transactionId: string;
	/** Called once the transaction is saved or deleted. */
	onDone: () => void | Promise<void>;
}

/**
 * Changes or deletes a transaction, for the holders of its account; the
 * other members who may see it read it.
 */
export function EditTransactionPage({
	household,
	transactionId,
	onDone,
}: EditTransactionPageProps) {
	const { data: transaction } = useSuspenseQuery(
		transactionQueryOptions(household.id, transactionId),
	);
	const { data: accounts } = useSuspenseQuery(
		accountsQueryOptions(household.id),
	);
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const refresh = useTransactionChange(household.id);
	const finish = async (message: string) => {
		// Leave first: the page must not reload a transaction that no longer exists
		await onDone();
		toast.success(message);
		await refresh();
	};

	return (
		<section className="mx-auto grid max-w-md gap-6 px-4 py-12">
			<TransactionsBackLink />
			<h1 className="font-heading font-semibold text-2xl">
				{m.transaction_edit_title()}
			</h1>
			{canEditTransaction(transaction, accounts.items) ? (
				<>
					<TransactionForm
						currency={household.currency}
						accounts={accounts.items}
						tags={tags}
						transaction={transaction}
						submitLabel={m.save_button()}
						save={(input) =>
							getApi().transactions.replace(household.id, transaction.id, input)
						}
						onSaved={() => finish(m.toast_transaction_saved())}
					/>
					<div className="justify-self-start">
						<DeleteTransactionButton
							transaction={transaction}
							onDeleted={() => finish(m.toast_transaction_deleted())}
						/>
					</div>
				</>
			) : (
				<>
					<TransactionList
						transactions={[transaction]}
						accounts={accounts.items}
						tags={tags}
						currency={household.currency}
					/>
					<p className="text-muted-foreground">{m.transaction_read_only()}</p>
				</>
			)}
		</section>
	);
}
