import type { Account } from "@repo/schemas";
import { useId } from "react";
import { AccountItem } from "@/features/accounts/AccountItem";

interface AccountGroupProps {
	title: string;
	accounts: Account[];
	currency: string;
	showHolders: boolean;
}

/** A titled list of accounts; renders nothing when it has none. */
export function AccountGroup({
	title,
	accounts,
	currency,
	showHolders,
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
					/>
				))}
			</ul>
		</section>
	);
}
