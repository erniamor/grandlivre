import type { Account } from "@repo/schemas";
import { Button, buttonVariants, cn } from "@repo/ui";
import { Link } from "@tanstack/react-router";
import { statementAccountName } from "@/features/imports/import-draft";
import type { Imported } from "@/features/imports/use-statement-import";
import { formatDay } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface ImportResultProps {
	imported: Imported;
	accounts: Account[];
	currency: string;
	onAgain: () => void;
}

/**
 * What an import did, account by account, and whether each account's
 * balance is now the bank's: when it isn't, the account's page adjusts it.
 */
export function ImportResult({
	imported,
	accounts,
	currency,
	onAgain,
}: ImportResultProps) {
	const locale = getLocale();
	const money = (amount: number) => formatAmount(amount, currency, locale);

	return (
		<section className="grid gap-4" aria-live="polite">
			<h2 className="font-heading font-semibold text-lg">
				{m.import_done_title()}
			</h2>
			<ul className="grid gap-3">
				{imported.result.accounts.map((counts) => {
					const account = accounts.find((each) => each.id === counts.accountId);
					const statement = imported.preview?.accounts.find(
						(each) => each.accountId === counts.accountId,
					);
					const bank = statement?.closingBalance ?? null;
					return (
						<li
							key={counts.accountId}
							className="grid gap-1 rounded-lg border border-border p-4"
						>
							<p className="font-medium">
								{account?.name ??
									(statement ? statementAccountName(statement) : "")}
							</p>
							<p className="text-sm">
								{m.import_done_counts({
									created: counts.created,
									linked: counts.linked,
									confirmed: counts.confirmed,
									joined: counts.joined,
								})}
							</p>
							{counts.openingBalance !== null && (
								<p className="text-sm">
									{m.import_done_opening({
										amount: money(counts.openingBalance),
									})}
								</p>
							)}
							{account && statement && bank !== null && (
								<p className="text-muted-foreground text-sm">
									{bank === account.balance
										? m.import_done_balance_same({
												date: formatDay(statement.to, locale),
											})
										: m.import_done_balance_gap({
												date: formatDay(statement.to, locale),
												bank: money(bank),
												app: money(account.balance),
											})}
								</p>
							)}
							{account && (
								<Link
									to="/accounts/$accountId"
									params={{ accountId: account.id }}
									className={cn(
										buttonVariants({ variant: "link" }),
										"justify-self-start px-0",
									)}
								>
									{m.import_done_open_account()}
								</Link>
							)}
						</li>
					);
				})}
			</ul>
			<Button
				type="button"
				variant="outline"
				className="justify-self-start"
				onClick={onAgain}
			>
				{m.import_again()}
			</Button>
		</section>
	);
}
