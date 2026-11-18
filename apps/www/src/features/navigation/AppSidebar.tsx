import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui";
import { Link } from "@tanstack/react-router";
import { useCachedHousehold } from "@/features/households/use-cached-household";
import { navItems } from "@/features/navigation/nav-items";
import { sideLinkClass } from "@/features/navigation/nav-styles";
import { m } from "@/paraglide/messages";

interface AppSidebarProps {
	/** The household chosen on this device, if any (see currentHousehold). */
	preferredHousehold?: string;
}

/**
 * The app's pages in a column at the side, from a tablet up: their icons
 * alone, named by a tooltip, then their names too on a wide screen. It
 * stays in view while the page scrolls. A phone has the tab bar instead.
 */
export function AppSidebar({ preferredHousehold }: AppSidebarProps) {
	const household = useCachedHousehold(preferredHousehold);

	return (
		<nav
			aria-label={m.main_nav_label()}
			className="sticky top-0 hidden max-h-svh shrink-0 self-start overflow-y-auto border-border border-r p-2 md:block md:w-16 lg:w-56"
		>
			<ul className="grid gap-1">
				{navItems(household).map((item) => (
					<li key={item.to}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Link to={item.to} className={sideLinkClass}>
									<item.icon aria-hidden className="size-5 shrink-0" />
									<span className="truncate max-lg:sr-only">
										{item.label()}
									</span>
								</Link>
							</TooltipTrigger>
							{/* Its name already shows on a wide screen */}
							<TooltipContent side="right" className="lg:hidden">
								{item.label()}
							</TooltipContent>
						</Tooltip>
					</li>
				))}
			</ul>
		</nav>
	);
}
