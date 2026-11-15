import { cn } from "@repo/ui";
import { Link } from "@tanstack/react-router";
import {
	ArrowLeftRightIcon,
	ChartPieIcon,
	LayoutDashboardIcon,
	RepeatIcon,
	TagsIcon,
	WalletIcon,
} from "lucide-react";
import { headerButtonClass } from "@/components/header-styles";
import { m } from "@/paraglide/messages";

const items = [
	{ to: "/dashboard", label: m.dashboard_title, icon: LayoutDashboardIcon },
	{
		to: "/transactions",
		label: m.transactions_title,
		icon: ArrowLeftRightIcon,
	},
	{ to: "/recurring", label: m.recurring_title, icon: RepeatIcon },
	{ to: "/reports", label: m.reports_title, icon: ChartPieIcon },
	{ to: "/accounts", label: m.accounts_title, icon: WalletIcon },
	{ to: "/tags", label: m.tags_title, icon: TagsIcon },
] as const;

/**
 * The links to the app's pages, on the header's band: each with its icon and
 * its name. On a narrow screen the row scrolls sideways rather than wrap.
 */
export function MainNav() {
	return (
		<nav
			aria-label={m.main_nav_label()}
			className="-mx-1 flex gap-1 overflow-x-auto px-1"
		>
			{items.map(({ to, label, icon: Icon }) => (
				<Link
					key={to}
					to={to}
					className={cn(
						headerButtonClass,
						"shrink-0 px-3 data-[status=active]:bg-inverse-foreground/10",
					)}
				>
					<Icon aria-hidden className="size-4" />
					{label()}
				</Link>
			))}
		</nav>
	);
}
