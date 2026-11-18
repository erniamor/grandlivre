import { Link, useLocation } from "@tanstack/react-router";
import { useCachedHousehold } from "@/features/households/use-cached-household";
import { MoreSheet } from "@/features/navigation/MoreSheet";
import { isUnder, navItems, tabLabel } from "@/features/navigation/nav-items";
import { tabClass } from "@/features/navigation/nav-styles";
import { tabBarHeightClass } from "@/features/navigation/tab-bar";
import { m } from "@/paraglide/messages";

interface BottomTabBarProps {
	/** The household chosen on this device, if any (see currentHousehold). */
	preferredHousehold?: string;
}

/**
 * The app's pages at the bottom of a phone's screen, under the thumb: four
 * tabs, each its icon above a short name, and "More" for the others. From a
 * tablet up, the side bar takes its place.
 */
export function BottomTabBar({ preferredHousehold }: BottomTabBarProps) {
	const household = useCachedHousehold(preferredHousehold);
	const pathname = useLocation({ select: (location) => location.pathname });
	const items = navItems(household);
	const tabs = items.filter((item) => item.tab);
	const others = items.filter((item) => !item.tab);

	return (
		<nav
			aria-label={m.main_nav_label()}
			className="fixed inset-x-0 bottom-0 z-40 border-border border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
		>
			<ul className={`grid grid-cols-5 ${tabBarHeightClass}`}>
				{tabs.map((item) => (
					<li key={item.to} className="min-w-0">
						<Link to={item.to} className={tabClass}>
							<item.icon aria-hidden className="size-5" />
							<span className="max-w-full truncate">{tabLabel(item)}</span>
						</Link>
					</li>
				))}
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
