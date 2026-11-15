import type { Account, RecurringTransaction, Tag } from "@repo/schemas";
import { cn } from "@repo/ui";
import { Link } from "@tanstack/react-router";
import { scheduleLabel } from "@/features/recurring/schedule-label";
import { buildTagTree, flattenTagTree } from "@/features/tags/tag-tree";
import { formatDay } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface RecurringItemProps {
	recurring: RecurringTransaction;
	accounts: Account[];
	tags: Tag[];
	currency: string;
	/** Links it to its page. */
	linked?: boolean;
}

const typeLabels = {
	expense: m.transaction_type_expense,
	income: m.transaction_type_income,
	transfer: m.transaction_type_transfer,
};

const modeLabels = {
	automatic: m.recurring_mode_automatic,
	confirm: m.recurring_mode_confirm,
};

/** One recurring transaction: what it records, how often, and when next. */
export function RecurringItem({
	recurring,
	accounts,
	tags,
	currency,
	linked = false,
}: RecurringItemProps) {
	const locale = getLocale();
	const { transaction, schedule, nextDate, mode } = recurring;
	const nameOf = (id: string | null) =>
		accounts.find((account) => account.id === id)?.name ??
		m.transaction_unknown_account();
	const tagPaths = new Map(
		flattenTagTree(buildTagTree(tags, locale)).map(({ tag, path }) => [
			tag.id,
			path,
		]),
	);
	const title = transaction.payee ?? typeLabels[transaction.type]();
	const where =
		transaction.type === "transfer"
			? m.transaction_transfer_accounts({
					from: nameOf(transaction.accountId),
					to: nameOf(transaction.toAccountId),
				})
			: [
					...new Set(
						transaction.lines.map(
							(line) =>
								(line.tagId && tagPaths.get(line.tagId)) ||
								m.transaction_uncategorized(),
						),
					),
					nameOf(transaction.accountId),
				].join(" · ");
	// Money going out, coming in, or moving between the household's accounts
	const direction =
		transaction.type === "expense" ? -1 : transaction.type === "income" ? 1 : 0;

	return (
		<li className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-card p-4 text-card-foreground">
			<div className="grid min-w-40 flex-1 gap-0.5">
				<p className="break-words font-medium">
					{linked ? (
						<Link
							to="/recurring/$recurringId"
							params={{ recurringId: recurring.id }}
							className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
						>
							{title}
						</Link>
					) : (
						title
					)}
				</p>
				<p className="break-words text-muted-foreground text-sm">{where}</p>
				<p className="break-words text-muted-foreground text-sm">
					{[
						scheduleLabel(schedule),
						nextDate
							? m.recurring_next({ date: formatDay(nextDate, locale) })
							: m.recurring_ended(),
						modeLabels[mode](),
					].join(" · ")}
				</p>
			</div>
			<span
				className={cn(
					"whitespace-nowrap font-medium tabular-nums",
					direction === 1 && "text-primary",
					direction === 0 && "text-muted-foreground",
				)}
			>
				{formatAmount(transaction.amount * (direction || 1), currency, locale, {
					signed: direction !== 0,
				})}
			</span>
		</li>
	);
}
