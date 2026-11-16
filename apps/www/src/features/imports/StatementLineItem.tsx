import type { Account, StatementPreviewLine } from "@repo/schemas";
import type { SelectOption } from "@/components/SelectField";
import type { LineChoice } from "@/features/imports/import-draft";
import { LineChoiceField } from "@/features/imports/LineChoiceField";
import { formatShortDay } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface StatementLineItemProps {
	line: StatementPreviewLine;
	/** Null for a line already imported: nothing to decide. */
	choice: LineChoice | null;
	holds: boolean;
	/** The account the line's pair goes to, when the pair records the transfer. */
	pairedWith: string | null;
	pairName: string | null;
	currency: string;
	transferAccounts: Account[];
	tagOptions: SelectOption<string>[];
	missing?: string;
	onChange: (choice: LineChoice) => void;
}

/** A line of the statement: its day, payee and amount, and what becomes of it. */
export function StatementLineItem({
	line,
	choice,
	holds,
	pairedWith,
	pairName,
	currency,
	transferAccounts,
	tagOptions,
	missing,
	onChange,
}: StatementLineItemProps) {
	const locale = getLocale();

	return (
		<li className="grid gap-2 border-border border-b py-3 last:border-b-0">
			<div className="flex flex-wrap items-baseline justify-between gap-x-4">
				<p className="min-w-0">
					<span className="text-muted-foreground text-sm">
						{formatShortDay(line.date, locale)}
					</span>{" "}
					<span className="font-medium">{line.payee}</span>
				</p>
				<p className="tabular-nums">
					{formatAmount(line.amount, currency, locale, { signed: true })}
				</p>
			</div>
			<p className="break-words text-muted-foreground text-xs">
				{line.description}
			</p>
			{pairedWith !== null ? (
				<p className="text-sm">
					{m.import_line_paired({ account: pairedWith })}
				</p>
			) : (
				choice && (
					<LineChoiceField
						line={line}
						choice={choice}
						holds={holds}
						pairName={pairName}
						transferAccounts={transferAccounts}
						tagOptions={tagOptions}
						missing={missing}
						onChange={onChange}
					/>
				)
			)}
		</li>
	);
}
