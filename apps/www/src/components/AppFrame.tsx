import { cn } from "@repo/ui";
import type { ReactNode } from "react";
import { AppSidebar } from "@/features/navigation/AppSidebar";
import { BottomTabBar } from "@/features/navigation/BottomTabBar";
import { clearTabBarClass } from "@/features/navigation/tab-bar";

interface AppFrameProps {
	/** Signed in: the app's pages are offered, at the side or at the bottom. */
	signedIn: boolean;
	/** The household chosen on this device, if any (see currentHousehold). */
	preferredHousehold?: string;
	children: ReactNode;
}

/**
 * What surrounds a page under the header: for a signed-in user, the side
 * bar from a tablet up, the tab bar on a phone, kept clear of the page's end.
 */
export function AppFrame({
	signedIn,
	preferredHousehold,
	children,
}: AppFrameProps) {
	if (!signedIn) {
		return <main>{children}</main>;
	}
	return (
		<div className="md:flex">
			<AppSidebar preferredHousehold={preferredHousehold} />
			<main className={cn("min-w-0 flex-1", clearTabBarClass)}>{children}</main>
			<BottomTabBar preferredHousehold={preferredHousehold} />
		</div>
	);
}
