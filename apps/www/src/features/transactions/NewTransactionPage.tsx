import type { Household } from "@repo/schemas";
import { buttonVariants, toast } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { rememberLastAccount } from "@/features/transactions/last-account";
import { TransactionForm } from "@/features/transactions/TransactionForm";
import { TransactionsBackLink } from "@/features/transactions/TransactionsBackLink";
import { writableAccounts } from "@/features/transactions/transaction-form";
import { useTransactionChange } from "@/features/transactions/use-transaction-change";
import { getApi } from "@/lib/api";
import { m } from "@/paraglide/messages";

interface NewTransactionPageProps {
	household: Household;
	/** The account proposed, e.g. the one the list was filtered on. */
	accountId?: string;
	/** Called once the transaction is recorded. */
	onCreated: () => void | Promise<void>;
}

/** Records a transaction on an account the signed-in user holds. */
export function NewTransactionPage({
	household,
	accountId,
	onCreated,
}: NewTransactionPageProps) {
	const { data: accounts } = useSuspenseQuery(
		accountsQueryOptions(household.id),
	);
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const refresh = useTransactionChange(household.id);

	return (
		<section className="mx-auto grid max-w-md gap-6 px-4 py-12">
			<TransactionsBackLink />
			<h1 className="font-heading font-semibold text-2xl">
				{m.transaction_new_title()}
			</h1>
			{writableAccounts(accounts.items).length === 0 ? (
				// Transactions are recorded on an account the user holds
				<div className="grid gap-4">
					<p className="text-muted-foreground">{m.transaction_no_account()}</p>
					<Link
						to="/accounts/new"
						className={`${buttonVariants()} justify-self-start`}
					>
						{m.account_add_button()}
					</Link>
				</div>
			) : (
				<TransactionForm
					currency={household.currency}
					accounts={accounts.items}
					tags={tags}
					defaultAccountId={accountId}
					submitLabel={m.transaction_create_button()}
					save={(input) => getApi().transactions.create(household.id, input)}
					onSaved={async (transaction) => {
						rememberLastAccount(transaction.accountId);
						await refresh();
						toast.success(m.toast_transaction_created());
						await onCreated();
					}}
				/>
			)}
		</section>
	);
}
