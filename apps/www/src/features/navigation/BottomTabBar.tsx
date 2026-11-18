import { cn } from "@repo/ui";
import { Link, useLocation } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useCachedHousehold } from "@/features/households/use-cached-household";
import { MoreSheet } from "@/features/navigation/MoreSheet";
import { NewTransactionSheet } from "@/features/navigation/NewTransactionSheet";
import { isUnder, navItems, tabLabel } from "@/features/navigation/nav-items";
import { tabClass } from "@/features/navigation/nav-styles";
import { tabBarHeightClass } from "@/features/navigation/tab-bar";
import { m } from "@/paraglide/messages";

interface BottomTabBarProps {
	/** The household chosen on this device, if any (see currentHousehold). */
	preferredHousehold?: string;
}

/**
 * The app's pages at the bottom of a phone's screen, under the thumb: three
 * tabs, each its icon above a short name, and "More" for the others; right
 * in the middle, two on each side, once a household is chosen, "+" records
 * a transaction from any page. From a tablet up, the side bar takes its place.
 */
export function BottomTabBar({ preferredHousehold }: BottomTabBarProps) {
	const household = useCachedHousehold(preferredHousehold);
	const pathname = useLocation({ select: (location) => location.pathname });
	const items = navItems(household);
	const tabs = items.filter((item) => item.tab);
	const others = items.filter((item) => !item.tab);

	const tab = (item: (typeof tabs)[number]) => (
		<li key={item.to} className="min-w-0">
			<Link to={item.to} className={tabClass}>
				<item.icon aria-hidden className="size-5" />
				<span className="max-w-full truncate">{tabLabel(item)}</span>
			</Link>
		</li>
	);
	const newTransaction: ReactNode = household && (
		<li className="flex items-center justify-center">
			<NewTransactionSheet householdId={household.id} side="bottom">
				<button
					type="button"
					aria-label={m.transaction_new_title()}
					className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
				>
					<PlusIcon aria-hidden className="size-6" />
				</button>
			</NewTransactionSheet>
		</li>
	);

	return (
		<nav
			aria-label={m.main_nav_label()}
			className="fixed inset-x-0 bottom-0 z-40 border-border border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
		>
			<ul
				className={cn(
					"grid",
					household ? "grid-cols-5" : "grid-cols-4",
					tabBarHeightClass,
				)}
			>
				{tabs.slice(0, 2).map(tab)}
				{newTransaction}
				{tabs.slice(2).map(tab)}
				<li className="min-w-0">
					<MoreSheet
						items={others}
						current={others.some((item) => isUnder(item, pathname))}
					/>
				</li>
			</ul>
		</nav>
	);
}
