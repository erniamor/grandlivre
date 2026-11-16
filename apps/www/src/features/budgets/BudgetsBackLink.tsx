import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { m } from "@/paraglide/messages";

interface BudgetsBackLinkProps {
	/** The month to go back to. */
	month: string;
}

/** Link from a budget's page back to the budgets of the month. */
export function BudgetsBackLink({ month }: BudgetsBackLinkProps) {
	return (
		<Link
			to="/budgets"
			search={{ month }}
			className="inline-flex items-center gap-1.5 justify-self-start rounded-sm text-muted-foreground text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
		>
			<ArrowLeftIcon aria-hidden className="size-4" />
			{m.budgets_back_link()}
		</Link>
	);
}
