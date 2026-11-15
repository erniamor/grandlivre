import type { Household } from "@repo/schemas";
import { buttonVariants, cn } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { RecurringItem } from "@/features/recurring/RecurringItem";
import { recurringListQueryOptions } from "@/features/recurring/recurring-query";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { writableAccounts } from "@/features/transactions/transaction-form";
import { m } from "@/paraglide/messages";

interface RecurringPageProps {
	household: Household;
}

/** The household's recurring transactions the user may see, the next due first. */
export function RecurringPage({ household }: RecurringPageProps) {
	const { data: recurring } = useSuspenseQuery(
		recurringListQueryOptions(household.id),
	);
	const { data: accounts } = useSuspenseQuery(
		accountsQueryOptions(household.id),
	);
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));

	return (
		<section className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
			<header className="grid gap-2">
				<h1 className="font-heading font-semibold text-2xl">
					{m.recurring_title()}
				</h1>
				<p className="text-muted-foreground">{m.recurring_intro()}</p>
			</header>
			{writableAccounts(accounts.items).length > 0 && (
				<Link
					to="/recurring/new"
					className={cn(buttonVariants(), "justify-self-start")}
				>
					<PlusIcon aria-hidden />
					{m.recurring_add_button()}
				</Link>
			)}
			{recurring.items.length === 0 ? (
				<p className="text-muted-foreground">{m.recurring_empty()}</p>
			) : (
				<ul className="grid gap-2">
					{recurring.items.map((item) => (
						<RecurringItem
							key={item.id}
							recurring={item}
							accounts={accounts.items}
							tags={tags}
							currency={household.currency}
							linked
						/>
					))}
				</ul>
			)}
		</section>
	);
}
