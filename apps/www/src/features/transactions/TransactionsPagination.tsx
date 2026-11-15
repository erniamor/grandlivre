import { buttonVariants } from "@repo/ui";
import { Link } from "@tanstack/react-router";
import {
	type TransactionListFilters,
	toSearch,
} from "@/features/transactions/transaction-filters";
import { m } from "@/paraglide/messages";

interface TransactionsPaginationProps {
	page: number;
	pageCount: number;
	/** The filters of the list, kept from page to page. */
	filters: TransactionListFilters;
}

const linkClass = buttonVariants({ variant: "outline", size: "sm" });

/** Links to the previous and next pages; nothing when there is a single page. */
export function TransactionsPagination({
	page,
	pageCount,
	filters,
}: TransactionsPaginationProps) {
	if (pageCount <= 1) {
		return null;
	}
	return (
		<nav
			aria-label={m.pagination_label()}
			className="flex flex-wrap items-center justify-between gap-2"
		>
			{page > 1 ? (
				<Link
					to="/transactions"
					search={toSearch(filters, page - 1)}
					className={linkClass}
				>
					{m.pagination_previous()}
				</Link>
			) : (
				<span />
			)}
			<p className="text-muted-foreground text-sm">
				{m.pagination_page({ page, pageCount })}
			</p>
			{page < pageCount ? (
				<Link
					to="/transactions"
					search={toSearch(filters, page + 1)}
					className={linkClass}
				>
					{m.pagination_next()}
				</Link>
			) : (
				<span />
			)}
		</nav>
	);
}
