import type { Household } from "@repo/schemas";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SelectField, type SelectOption } from "@/components/SelectField";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { TransactionList } from "@/features/transactions/TransactionList";
import { TransactionsPagination } from "@/features/transactions/TransactionsPagination";
import { accountsWithDetails } from "@/features/transactions/transaction-view";
import { transactionsQueryOptions } from "@/features/transactions/transactions-query";
import { m } from "@/paraglide/messages";

interface TransactionsPageProps {
	household: Household;
	/** The account whose transactions are shown; all of them without it. */
	accountId?: string;
	page: number;
	onAccountChange: (accountId: string | undefined) => void;
}

// A select's value is a string: this one stands for "every account"
const ALL = "";

/** The household's transactions the user may see, most recent first. */
export function TransactionsPage({
	household,
	accountId,
	page,
	onAccountChange,
}: TransactionsPageProps) {
	const { data: transactions } = useSuspenseQuery(
		transactionsQueryOptions(household.id, { accountId, page }),
	);
	const { data: accounts } = useSuspenseQuery(
		accountsQueryOptions(household.id),
	);
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const accountOptions: SelectOption<string>[] = [
		{ value: ALL, label: m.transactions_all_accounts() },
		...accountsWithDetails(accounts.items).map((account) => ({
			value: account.id,
			label: account.name,
		})),
	];

	return (
		<section className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
			<header className="grid gap-2">
				<h1 className="font-heading font-semibold text-2xl">
					{m.transactions_title()}
				</h1>
				<p className="text-muted-foreground">{m.transactions_intro()}</p>
			</header>
			<SelectField
				label={m.transactions_account_filter_label()}
				value={accountId ?? ALL}
				options={accountOptions}
				onChange={(value) => onAccountChange(value === ALL ? undefined : value)}
				tone="default"
				className="grid items-stretch font-medium"
			/>
			{transactions.items.length === 0 ? (
				<p className="text-muted-foreground">
					{accountId ? m.transactions_empty_account() : m.transactions_empty()}
				</p>
			) : (
				<TransactionList
					transactions={transactions.items}
					accounts={accounts.items}
					tags={tags}
					currency={household.currency}
					accountId={accountId}
				/>
			)}
			<TransactionsPagination
				page={transactions.page}
				pageCount={Math.ceil(transactions.total / transactions.pageSize)}
				accountId={accountId}
			/>
		</section>
	);
}
