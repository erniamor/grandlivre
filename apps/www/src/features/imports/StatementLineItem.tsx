import type { Account, StatementPreviewLine } from "@repo/schemas";
import { cn } from "@repo/ui";
import type { SelectOption } from "@/components/SelectField";
import type { LineChoice } from "@/features/imports/import-draft";
import { LineChoiceField } from "@/features/imports/LineChoiceField";
import { LineStatusBadge } from "@/features/imports/LineStatusBadge";
import { formatShortDay } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface StatementLineItemProps {
	line: StatementPreviewLine;
	/** What the line already is, where its account goes: "new" when nothing. */
	status: StatementPreviewLine["status"];
	/** Null for a line already imported: nothing to decide. */
	choice: LineChoice | null;
	holds: boolean;
	/** The account the line's pair goes to, when the pair records the transfer. */
	pairedWith: string | null;
	pairName: string | null;
	/** The account the transaction it matches is on. */
	matchAccountName: string | null;
	currency: string;
	transferAccounts: Account[];
	tagOptions: SelectOption<string>[];
	missing?: string;
	onChange: (choice: LineChoice) => void;
}

/**
 * A line of the statement: its day, payee and amount, what it already is
 * in the app (a line already there stands back, with its badge), and what
 * becomes of it.
 */
export function StatementLineItem({
	line,
	status,
	choice,
	holds,
	pairedWith,
	pairName,
	matchAccountName,
	currency,
	transferAccounts,
	tagOptions,
	missing,
	onChange,
}: StatementLineItemProps) {
	const locale = getLocale();
	const known = status !== "new";

	return (
		<li
			className={cn(
				"grid gap-2 py-3",
				known
					? "my-1 rounded-md bg-muted px-3 text-muted-foreground"
					: "border-border border-b last:border-b-0",
			)}
		>
			<div className="flex flex-wrap items-baseline justify-between gap-x-4">
				<p className="min-w-0">
					<span className="text-muted-foreground text-sm">
						{formatShortDay(line.date, locale)}
					</span>{" "}
					<span className={cn("font-medium", !known && "text-foreground")}>
						{line.payee}
					</span>
				</p>
				<p className="tabular-nums">
					{formatAmount(line.amount, currency, locale, { signed: true })}
				</p>
			</div>
			<p className="break-words text-muted-foreground text-xs">
				{line.description}
			</p>
			{known && (
				<div>
					<LineStatusBadge status={status} accountName={matchAccountName} />
				</div>
			)}
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
						matchAccountName={matchAccountName}
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
