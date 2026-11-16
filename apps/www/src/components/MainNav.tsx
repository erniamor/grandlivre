import { cn } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	ArrowLeftRightIcon,
	ChartPieIcon,
	LayoutDashboardIcon,
	PiggyBankIcon,
	RepeatIcon,
	ScaleIcon,
	TagsIcon,
	WalletIcon,
} from "lucide-react";
import { headerButtonClass } from "@/components/header-styles";
import {
	currentHousehold,
	householdsQueryOptions,
} from "@/features/households/households-query";
import { m } from "@/paraglide/messages";

const items = [
	{ to: "/dashboard", label: m.dashboard_title, icon: LayoutDashboardIcon },
	{
		to: "/transactions",
		label: m.transactions_title,
		icon: ArrowLeftRightIcon,
	},
	{ to: "/recurring", label: m.recurring_title, icon: RepeatIcon },
	{ to: "/budgets", label: m.budgets_title, icon: PiggyBankIcon },
	{ to: "/reports", label: m.reports_title, icon: ChartPieIcon },
	{ to: "/accounts", label: m.accounts_title, icon: WalletIcon },
	{ to: "/tags", label: m.tags_title, icon: TagsIcon },
] as const;

/** Shown only to the households that settle shared expenses. */
const sharingItem = {
	to: "/shared",
	label: m.sharing_title,
	icon: ScaleIcon,
} as const;

/**
 * The links to the app's pages, on the header's band: each with its icon and
 * its name. On a narrow screen the row scrolls sideways rather than wrap.
 */
export function MainNav() {
	// The households the pages loaded, from the cache: no request of its own
	const { data: households } = useQuery({
		...householdsQueryOptions(),
		enabled: false,
	});
	const household = households ? currentHousehold(households) : null;
	const links = household?.expenseSharing ? [...items, sharingItem] : items;

	return (
		<nav
			aria-label={m.main_nav_label()}
			className="-mx-1 flex gap-1 overflow-x-auto px-1"
		>
			{links.map(({ to, label, icon: Icon }) => (
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
