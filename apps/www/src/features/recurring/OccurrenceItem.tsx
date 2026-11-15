import type { Account, RecurringTransaction, Tag } from "@repo/schemas";
import { cn } from "@repo/ui";
import type { ReactNode } from "react";
import {
	templateDirection,
	templateTitle,
	templateWhere,
} from "@/features/recurring/recurring-view";
import { formatDay } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { getLocale } from "@/paraglide/runtime";

interface OccurrenceItemProps {
	/** The day it comes due. */
	date: string;
	recurring: RecurringTransaction;
	accounts: Account[];
	tags: Tag[];
	currency: string;
	/** Said after the day: whether it is automatic, say. */
	status?: string;
	/** What can be done with it. */
	children?: ReactNode;
}

/** A day a recurring transaction comes due: what, where, when, and how much. */
export function OccurrenceItem({
	date,
	recurring,
	accounts,
	tags,
	currency,
	status,
	children,
}: OccurrenceItemProps) {
	const locale = getLocale();
	const { transaction } = recurring;
	const direction = templateDirection(transaction);

	return (
		<li className="grid gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
			<div className="flex flex-wrap items-center gap-x-4 gap-y-1">
				<div className="grid min-w-40 flex-1 gap-0.5">
					<p className="break-words font-medium">
						{templateTitle(transaction)}
					</p>
					<p className="break-words text-muted-foreground text-sm">
						{templateWhere(transaction, accounts, tags, locale)}
					</p>
					<p className="text-muted-foreground text-sm">
						{[formatDay(date, locale), status].filter(Boolean).join(" · ")}
					</p>
				</div>
				<span
					className={cn(
						"whitespace-nowrap font-medium tabular-nums",
						direction === 1 && "text-primary",
						direction === 0 && "text-muted-foreground",
					)}
				>
					{formatAmount(
						transaction.amount * (direction || 1),
						currency,
						locale,
						{
							signed: direction !== 0,
						},
					)}
				</span>
			</div>
			{children && <div className="flex flex-wrap gap-2">{children}</div>}
		</li>
	);
}
