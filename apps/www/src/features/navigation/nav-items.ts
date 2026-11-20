import type { Household } from "@repo/schemas";
import {
	ArrowLeftRightIcon,
	ChartPieIcon,
	CircleHelpIcon,
	FileUpIcon,
	LayoutDashboardIcon,
	PiggyBankIcon,
	RepeatIcon,
	ScaleIcon,
	SettingsIcon,
	TagsIcon,
	WalletIcon,
} from "lucide-react";
import { m } from "@/paraglide/messages";

/**
 * The app's pages, in the order the side bar lists them. `tab` marks the
 * three a phone's tab bar shows, two of them left of its "+", named by `tabLabel` when the page's name is
 * too long for it; the others are under its "More". `sharing` marks the
 * page shown only to the households that settle shared expenses.
 */
const allItems = [
	{
		to: "/dashboard",
		label: m.dashboard_title,
		tabLabel: m.nav_home,
		icon: LayoutDashboardIcon,
		tab: true,
	},
	{
		to: "/transactions",
		label: m.transactions_title,
		icon: ArrowLeftRightIcon,
		tab: true,
	},
	{ to: "/recurring", label: m.recurring_title, icon: RepeatIcon, tab: false },
	{ to: "/budgets", label: m.budgets_title, icon: PiggyBankIcon, tab: false },
	{ to: "/reports", label: m.reports_title, icon: ChartPieIcon, tab: true },
	{ to: "/accounts", label: m.accounts_title, icon: WalletIcon, tab: false },
	{ to: "/tags", label: m.tags_title, icon: TagsIcon, tab: false },
	{
		to: "/shared",
		label: m.sharing_title,
		icon: ScaleIcon,
		tab: false,
		sharing: true,
	},
	{ to: "/import", label: m.nav_import, icon: FileUpIcon, tab: false },
	{ to: "/household", label: m.nav_settings, icon: SettingsIcon, tab: false },
	{ to: "/help", label: m.help_link, icon: CircleHelpIcon, tab: false },
] as const;

export type NavItem = (typeof allItems)[number];

/** The pages offered to a member of `household` (none chosen yet: no sharing). */
export function navItems(household: Household | null): NavItem[] {
	return allItems.filter(
		(item) => !("sharing" in item) || household?.expenseSharing === true,
	);
}

/** The name a page goes by in the tab bar. */
export function tabLabel(item: NavItem): string {
	return "tabLabel" in item ? item.tabLabel() : item.label();
}

/** Whether `pathname` is `item`'s page or one under it. */
export function isUnder(item: NavItem, pathname: string): boolean {
	return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
