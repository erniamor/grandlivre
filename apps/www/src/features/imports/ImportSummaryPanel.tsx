import { useId } from "react";
import type { ImportSummary, Tally } from "@/features/imports/import-summary";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface ImportSummaryPanelProps {
	summary: ImportSummary;
	currency: string;
}

/**
 * What the file comes to, before importing it: what was found in the app,
 * and what the import will record, with the amounts.
 */
export function ImportSummaryPanel({
	summary,
	currency,
}: ImportSummaryPanelProps) {
	const titleId = useId();
	const locale = getLocale();
	const money = (tally: Tally) =>
		m.import_summary_tally({
			count: tally.count,
			amount: formatAmount(tally.amount, currency, locale),
		});
	const { found, record } = summary;
	// The rarer figures only when there are some
	const recorded = [
		{ label: m.import_summary_expenses(), value: money(record.expenses) },
		{ label: m.import_summary_incomes(), value: money(record.incomes) },
		{ label: m.import_summary_transfers(), value: money(record.transfers) },
		...(record.confirmed.count > 0
			? [
					{
						label: m.import_summary_confirmed(),
						value: money(record.confirmed),
					},
				]
			: []),
		...(record.linked > 0
			? [{ label: m.import_summary_linked(), value: String(record.linked) }]
			: []),
		...(record.joined > 0
			? [{ label: m.import_summary_joined(), value: String(record.joined) }]
			: []),
		...(record.skipped > 0
			? [{ label: m.import_summary_skipped(), value: String(record.skipped) }]
			: []),
	];
	const foundItems = [
		{ label: m.import_status_imported(), value: found.imported },
		{ label: m.import_status_matched(), value: found.matched },
		{ label: m.import_summary_counterpart(), value: found.counterpart },
		{ label: m.import_status_recurring(), value: found.recurring },
	].filter((item) => item.value > 0);

	return (
		<section
			aria-labelledby={titleId}
			className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4"
		>
			<header className="grid gap-0.5">
				<h2 id={titleId} className="font-heading font-semibold text-lg">
					{m.import_summary_title()}
				</h2>
				<p className="text-muted-foreground text-sm">
					{summary.skippedAccounts > 0
						? m.import_summary_read_skipped({
								lines: summary.lines,
								accounts: summary.accounts,
								skipped: summary.skippedAccounts,
							})
						: m.import_summary_read({
								lines: summary.lines,
								accounts: summary.accounts,
							})}
				</p>
			</header>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="grid content-start gap-1">
					<h3 className="font-medium text-sm">
						{m.import_summary_record_title({
							count: summary.newTransactions,
						})}
					</h3>
					<dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-sm">
						{recorded.map(({ label, value }) => (
							<div key={label} className="contents">
								<dt className="text-muted-foreground">{label}</dt>
								<dd className="text-right tabular-nums">{value}</dd>
							</div>
						))}
					</dl>
				</div>
				<div className="grid content-start gap-1">
					<h3 className="font-medium text-sm">
						{m.import_summary_found_title()}
					</h3>
					{foundItems.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							{m.import_summary_found_none()}
						</p>
					) : (
						<dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-sm">
							{foundItems.map(({ label, value }) => (
								<div key={label} className="contents">
									<dt className="text-muted-foreground">{label}</dt>
									<dd className="text-right tabular-nums">{value}</dd>
								</div>
							))}
						</dl>
					)}
				</div>
			</div>
		</section>
	);
}
