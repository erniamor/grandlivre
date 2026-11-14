import type { Profile } from "@repo/schemas";
import { InstallCard } from "@/features/pwa/InstallCard";
import { m } from "@/paraglide/messages";

interface DashboardPageProps {
	me: Profile;
}

/** Example page for signed-in users: the starting point of the app's own pages. */
export function DashboardPage({ me }: DashboardPageProps) {
	return (
		<section className="mx-auto grid max-w-5xl gap-6 px-4 py-12">
			<header className="grid gap-2">
				<h1 className="font-heading font-semibold text-3xl">
					{m.dashboard_title()}
				</h1>
				<p className="text-muted-foreground">{me.name || me.email}</p>
				<p className="max-w-prose text-muted-foreground">
					{m.dashboard_intro()}
				</p>
			</header>
			<InstallCard />
		</section>
	);
}
