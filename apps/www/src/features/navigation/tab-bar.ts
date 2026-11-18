/**
 * The room the tab bar takes at the bottom of a phone's screen (its height,
 * and the system's bar under it in the installed app), below the `md`
 * breakpoint where it shows. Written out whole, so Tailwind sees the classes.
 */
export const tabBarHeightClass = "h-16";

/** Keeps the end of a page clear of the tab bar. */
export const clearTabBarClass =
	"max-md:pb-[calc(4rem+env(safe-area-inset-bottom))]";

/** Puts what sticks to the bottom of the screen above the tab bar. */
export const aboveTabBarClass =
	"max-md:bottom-[calc(4rem+env(safe-area-inset-bottom))]";

/** The toasts' distance from the bottom, above the tab bar. */
export const toastOffsetAboveTabBar = {
	bottom: "calc(5rem + env(safe-area-inset-bottom))",
};
