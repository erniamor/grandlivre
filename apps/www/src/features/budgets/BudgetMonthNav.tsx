import { Link } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { shiftMonth } from "@/features/budgets/budget-view";
import { monthLabel } from "@/features/reports/month-label";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface BudgetMonthNavProps {
	/** The month shown: "2026-11". */
	month: string;
}

const linkClass =
	"inline-flex size-9 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";

/** The month shown, with links to the one before and the one after. */
export function BudgetMonthNav({ month }: BudgetMonthNavProps) {
	return (
		<nav
			aria-label={m.budgets_month_nav_label()}
			className="flex items-center justify-between gap-2"
		>
			<Link
				to="/budgets"
				search={{ month: shiftMonth(month, -1) }}
				aria-label={m.budgets_previous_month()}
				className={linkClass}
			>
				<ChevronLeftIcon aria-hidden className="size-4" />
			</Link>
			<p className="font-medium first-letter:uppercase" aria-live="polite">
				{monthLabel(month, getLocale(), "long")}
			</p>
			<Link
				to="/budgets"
				search={{ month: shiftMonth(month, 1) }}
				aria-label={m.budgets_next_month()}
				className={linkClass}
			>
				<ChevronRightIcon aria-hidden className="size-4" />
			</Link>
		</nav>
	);
}
