import type { Household, Profile } from "@repo/schemas";
import { Link } from "@tanstack/react-router";
import { HouseholdBalance } from "@/features/accounts/HouseholdBalance";
import { InstallCard } from "@/features/pwa/InstallCard";
import { PendingRecurring } from "@/features/recurring/PendingRecurring";
import { UpcomingRecurring } from "@/features/recurring/UpcomingRecurring";
import { useOpenDraft } from "@/features/transactions/note-draft";
import { QuickEntry } from "@/features/transactions/QuickEntry";
import { RecentTransactions } from "@/features/transactions/RecentTransactions";
import { m } from "@/paraglide/messages";

interface DashboardPageProps {
	me: Profile;
	household: Household;
}

/** Home of a signed-in user: the starting point of their household's pages. */
export function DashboardPage({ me, household }: DashboardPageProps) {
	const openDraft = useOpenDraft();
	return (
		<section className="mx-auto grid max-w-5xl gap-6 px-4 py-12">
			<header className="grid gap-2">
				<h1 className="font-heading font-semibold text-3xl">
					{m.dashboard_title()}
				</h1>
				<p className="text-muted-foreground">{me.name || me.email}</p>
				<p className="max-w-prose text-muted-foreground">
					{m.dashboard_household({ name: household.name })}
				</p>
			</header>
			<QuickEntry
				householdId={household.id}
				onDraft={(draft, photo) => openDraft(draft, { photo })}
			/>
			<PendingRecurring household={household} />
			<HouseholdBalance household={household}>
				<Link
					to="/accounts"
					className="justify-self-start rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
				>
					{m.summary_accounts_link()}
				</Link>
			</HouseholdBalance>
			<RecentTransactions household={household} />
			<UpcomingRecurring household={household} />
			<InstallCard />
		</section>
	);
}
