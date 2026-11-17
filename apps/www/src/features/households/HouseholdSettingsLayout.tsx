import { cn } from "@repo/ui";
import { Link } from "@tanstack/react-router";
import { SlidersHorizontalIcon, UsersIcon } from "lucide-react";
import type { ReactNode } from "react";
import { m } from "@/paraglide/messages";

interface HouseholdSettingsLayoutProps {
	/** The section shown. */
	children: ReactNode;
}

const sections = [
	{
		to: "/household",
		label: m.household_section_general,
		icon: SlidersHorizontalIcon,
	},
	{ to: "/household/members", label: m.members_title, icon: UsersIcon },
] as const;

/**
 * The household's settings, one section at a time: a menu at the side on
 * a wide screen, a row of links above on a narrow one.
 */
export function HouseholdSettingsLayout({
	children,
}: HouseholdSettingsLayoutProps) {
	return (
		<section className="mx-auto grid max-w-4xl gap-8 px-4 py-12">
			<header className="grid gap-2">
				<h1 className="font-heading font-semibold text-2xl">
					{m.household_title()}
				</h1>
				<p className="text-muted-foreground">{m.household_intro()}</p>
			</header>
			<div className="grid gap-6 md:grid-cols-[12rem_1fr] md:gap-8">
				<nav aria-label={m.household_settings_nav()}>
					<ul className="-mx-1 flex gap-1 overflow-x-auto px-1 md:flex-col">
						{sections.map(({ to, label, icon: Icon }) => (
							<li key={to} className="shrink-0">
								<Link
									to={to}
									activeOptions={{ exact: true }}
									className={cn(
										"flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground text-sm hover:bg-muted hover:text-foreground",
										"focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
										"data-[status=active]:bg-muted data-[status=active]:font-medium data-[status=active]:text-foreground",
									)}
								>
									<Icon aria-hidden className="size-4" />
									{label()}
								</Link>
							</li>
						))}
					</ul>
				</nav>
				<div className="grid min-w-0 content-start gap-8">{children}</div>
			</div>
		</section>
	);
}
