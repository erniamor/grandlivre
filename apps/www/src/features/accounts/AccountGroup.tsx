import type { Account } from "@repo/schemas";
import { useId } from "react";
import { AccountItem } from "@/features/accounts/AccountItem";
import { canEditAccount } from "@/features/accounts/account-form";

interface AccountGroupProps {
	title: string;
	accounts: Account[];
	currency: string;
	showHolders: boolean;
	/** The signed-in user owns the household. */
	isHouseholdOwner: boolean;
}

/** A titled list of accounts; renders nothing when it has none. */
export function AccountGroup({
	title,
	accounts,
	currency,
	showHolders,
	isHouseholdOwner,
}: AccountGroupProps) {
	const titleId = useId();

	if (accounts.length === 0) {
		return null;
	}
	return (
		<section aria-labelledby={titleId} className="grid gap-3">
			<h2 id={titleId} className="font-heading font-semibold text-lg">
				{title}
			</h2>
			<ul className="grid gap-3">
				{accounts.map((account) => (
					<AccountItem
						key={account.id}
						account={account}
						currency={currency}
						showHolders={showHolders}
						editable={canEditAccount(account, isHouseholdOwner)}
					/>
				))}
			</ul>
		</section>
	);
}
