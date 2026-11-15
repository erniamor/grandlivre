import type { Account } from "@repo/schemas";
import { buttonVariants } from "@repo/ui";
import { Link } from "@tanstack/react-router";
import { PencilIcon } from "lucide-react";
import { WithTooltip } from "@/components/WithTooltip";
import { Amount } from "@/features/accounts/Amount";
import { accountTypeLabels } from "@/features/accounts/account-type-labels";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface AccountItemProps {
	account: Account;
	currency: string;
	/** Names the holders: useful when the account isn't the user's alone. */
	showHolders: boolean;
	/** The signed-in user may change the account: links to its form. */
	editable: boolean;
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
	editable,
}: AccountItemProps) {
	return (
		<li className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-card p-4 text-card-foreground">
			<div className="grid min-w-40 flex-1 gap-0.5">
				<p className="break-words font-medium">
					{account.isHolder || account.visibility === "details" ? (
						<Link
							to="/transactions"
							search={{ account: account.id }}
							aria-label={m.account_transactions_label({ name: account.name })}
							className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
						>
							{account.name}
						</Link>
					) : (
						account.name
					)}
				</p>
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
			{editable && (
				<WithTooltip label={m.edit_tooltip()}>
					<Link
						to="/accounts/$accountId"
						params={{ accountId: account.id }}
						aria-label={m.account_edit_label({ name: account.name })}
						className={buttonVariants({ variant: "ghost", size: "icon" })}
					>
						<PencilIcon aria-hidden className="size-4" />
					</Link>
				</WithTooltip>
			)}
		</li>
	);
}
