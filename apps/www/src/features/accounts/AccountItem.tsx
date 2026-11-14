import type { Account } from "@repo/schemas";
import { Amount } from "@/features/accounts/Amount";
import { accountTypeLabels } from "@/features/accounts/account-type-labels";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface AccountItemProps {
	account: Account;
	currency: string;
	/** Names the holders: useful when the account isn't the user's alone. */
	showHolders: boolean;
}

function holdersText(account: Account): string {
	if (account.holders.length === 0) {
		return m.account_no_holder();
	}
	const names = new Intl.ListFormat(getLocale(), {
		type: "conjunction",
	}).format(account.holders.map((holder) => holder.name));
	return m.account_holders({ names });
}

/** One account of the household, with its balance. */
export function AccountItem({
	account,
	currency,
	showHolders,
}: AccountItemProps) {
	return (
		<li className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-card p-4 text-card-foreground">
			<div className="grid min-w-40 flex-1 gap-0.5">
				<p className="break-words font-medium">{account.name}</p>
				<p className="text-muted-foreground text-sm">
					{accountTypeLabels[account.type]()}
					{showHolders && ` · ${holdersText(account)}`}
				</p>
			</div>
			<Amount
				amount={account.balance}
				currency={currency}
				className="font-medium"
			/>
		</li>
	);
}
