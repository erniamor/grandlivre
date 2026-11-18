import type { SharedExpense } from "@repo/schemas";
import { cn } from "@repo/ui";
import { sensitiveClass } from "@/components/sensitive";
import { formatDay } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface SharedExpenseListProps {
	expenses: SharedExpense[];
	nameOf: (userId: string) => string;
	meId: string;
	currency: string;
}

/** The shared expenses and refunds, the most recent first: who paid, and each part. */
export function SharedExpenseList({
	expenses,
	nameOf,
	meId,
	currency,
}: SharedExpenseListProps) {
	const locale = getLocale();
	const money = (amount: number) => formatAmount(amount, currency, locale);
	if (expenses.length === 0) {
		return <p className="text-muted-foreground">{m.shared_expenses_empty()}</p>;
	}

	return (
		<ul className="grid gap-2">
			{expenses.map((expense) => {
				const mine = expense.parts.find((part) => part.userId === meId);
				return (
					<li
						key={expense.transactionId}
						className="grid gap-1 rounded-lg border border-border bg-card p-4 text-card-foreground"
					>
						<div className="flex flex-wrap items-baseline justify-between gap-x-4">
							<span className={cn("font-medium", sensitiveClass)}>
								{expense.payee ??
									(expense.type === "income"
										? m.transaction_type_income()
										: m.transaction_type_expense())}
							</span>
							<span className={cn("tabular-nums", sensitiveClass)}>
								{formatAmount(
									expense.type === "income" ? expense.amount : -expense.amount,
									currency,
									locale,
									{ signed: true },
								)}
							</span>
						</div>
						<p className="text-muted-foreground text-sm">
							{[
								formatDay(expense.date, locale),
								m.shared_paid_by({ name: nameOf(expense.paidBy) }),
								mine
									? m.shared_your_part({ amount: money(mine.amount) })
									: null,
							]
								.filter(Boolean)
								.join(" · ")}
						</p>
						<p className="text-muted-foreground text-sm">
							{expense.parts
								.map((part) => `${nameOf(part.userId)} ${money(part.amount)}`)
								.join(" · ")}
						</p>
					</li>
				);
			})}
		</ul>
	);
}
