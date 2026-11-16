import type { Household } from "@repo/schemas";
import { buttonVariants, cn } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { useOpenDraft } from "@/features/transactions/note-draft";
import { QuickEntry } from "@/features/transactions/QuickEntry";
import { TransactionFilters } from "@/features/transactions/TransactionFilters";
import { TransactionList } from "@/features/transactions/TransactionList";
import { TransactionsPagination } from "@/features/transactions/TransactionsPagination";
import {
	hasFilters,
	hidesTransactions,
	type TransactionListFilters,
} from "@/features/transactions/transaction-filters";
import { transactionsQueryOptions } from "@/features/transactions/transactions-query";
import { m } from "@/paraglide/messages";

interface TransactionsPageProps {
	household: Household;
	filters: TransactionListFilters;
	page: number;
	/** New filters: back to their first page. */
	onFiltersChange: (filters: TransactionListFilters) => void;
}

/** The household's transactions the user may see, most recent first. */
export function TransactionsPage({
	household,
	filters,
	page,
	onFiltersChange,
}: TransactionsPageProps) {
	const { data: transactions } = useSuspenseQuery(
		transactionsQueryOptions(household.id, { ...filters, page }),
	);
	const { data: accounts } = useSuspenseQuery(
		accountsQueryOptions(household.id),
	);
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const openDraft = useOpenDraft();

	return (
		<section className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
			<header className="grid gap-2">
				<h1 className="font-heading font-semibold text-2xl">
					{m.transactions_title()}
				</h1>
				<p className="text-muted-foreground">{m.transactions_intro()}</p>
			</header>
			<Link
				to="/transactions/new"
				search={{ account: filters.accountId }}
				className={cn(buttonVariants(), "justify-self-start")}
			>
				<PlusIcon aria-hidden />
				{m.transaction_add_button()}
			</Link>
			<QuickEntry
				householdId={household.id}
				onDraft={(draft, photos) => openDraft(draft, { photos })}
			/>
			<TransactionFilters
				filters={filters}
				accounts={accounts.items}
				tags={tags}
				onChange={onFiltersChange}
			/>
			{transactions.items.length === 0 ? (
				<p className="text-muted-foreground">
					{hasFilters(filters)
						? m.transactions_empty_filtered()
						: m.transactions_empty()}
				</p>
			) : (
				<TransactionList
					transactions={transactions.items}
					accounts={accounts.items}
					tags={tags}
					currency={household.currency}
					accountId={filters.accountId}
					linked
				/>
			)}
			<TransactionsPagination
				page={transactions.page}
				pageCount={Math.ceil(transactions.total / transactions.pageSize)}
				filters={filters}
			/>
			{hidesTransactions(accounts.items) && (
				<p className="text-muted-foreground text-sm">
					{m.transactions_hidden_note()}
				</p>
			)}
		</section>
	);
}
