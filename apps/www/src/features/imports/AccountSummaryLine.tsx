import type { ImportSummary } from "@/features/imports/import-summary";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface AccountSummaryLineProps {
	summary: ImportSummary;
	currency: string;
}

/** What an account of the file adds, in one line: its new transactions and their amounts. */
export function AccountSummaryLine({
	summary,
	currency,
}: AccountSummaryLineProps) {
	const locale = getLocale();
	const { record } = summary;
	const money = (amount: number) => formatAmount(amount, currency, locale);

	return (
		<p className="text-sm">
			{m.import_account_record({
				count: summary.newTransactions,
				expenses: money(record.expenses.amount),
				incomes: money(record.incomes.amount),
				transfers: record.transfers.count,
			})}
		</p>
	);
}
