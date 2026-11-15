import type { Household } from "@repo/schemas";
import { buttonVariants, cn } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { AccountGroup } from "@/features/accounts/AccountGroup";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { groupAccounts } from "@/features/accounts/group-accounts";
import { HouseholdBalance } from "@/features/accounts/HouseholdBalance";
import { m } from "@/paraglide/messages";

interface AccountsPageProps {
	household: Household;
}

/** The household's accounts with their balances, and the consolidated view. */
export function AccountsPage({ household }: AccountsPageProps) {
	const { data: accounts } = useSuspenseQuery(
		accountsQueryOptions(household.id),
	);
	const groups = groupAccounts(accounts.items);
	const { currency } = household;
	const isHouseholdOwner = household.role === "owner";

	return (
		<section className="mx-auto grid max-w-2xl gap-8 px-4 py-12">
			<header className="grid gap-2">
				<h1 className="font-heading font-semibold text-2xl">
					{m.accounts_title()}
				</h1>
				<p className="text-muted-foreground">{m.accounts_intro()}</p>
			</header>
			<HouseholdBalance household={household} />
			<Link
				to="/accounts/new"
				className={cn(buttonVariants(), "justify-self-start")}
			>
				<PlusIcon aria-hidden />
				{m.account_add_button()}
			</Link>
			{accounts.items.length === 0 && (
				<p className="text-muted-foreground">{m.accounts_empty()}</p>
			)}
			<AccountGroup
				title={m.accounts_mine_title()}
				accounts={groups.mine}
				currency={currency}
				showHolders={false}
				isHouseholdOwner={isHouseholdOwner}
			/>
			<AccountGroup
				title={m.accounts_shared_title()}
				accounts={groups.shared}
				currency={currency}
				showHolders
				isHouseholdOwner={isHouseholdOwner}
			/>
			<AccountGroup
				title={m.accounts_others_title()}
				accounts={groups.others}
				currency={currency}
				showHolders
				isHouseholdOwner={isHouseholdOwner}
			/>
		</section>
	);
}
