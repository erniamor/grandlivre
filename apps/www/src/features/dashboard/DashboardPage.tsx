import type { Household, Profile } from "@repo/schemas";
import { BudgetsOverview } from "@/features/budgets/BudgetsOverview";
import { ExpenseBreakdownCard } from "@/features/dashboard/ExpenseBreakdownCard";
import { KeyFigures } from "@/features/dashboard/KeyFigures";
import { MonthlyExpensesCard } from "@/features/dashboard/MonthlyExpensesCard";
import { GettingStartedCard } from "@/features/getting-started/GettingStartedCard";
import { DemoBanner } from "@/features/households/DemoBanner";
import { InstallCard } from "@/features/pwa/InstallCard";
import { PendingRecurring } from "@/features/recurring/PendingRecurring";
import { UpcomingRecurring } from "@/features/recurring/UpcomingRecurring";
import { SharingSummary } from "@/features/sharing/SharingSummary";
import { useOpenDraft } from "@/features/transactions/note-draft";
import { QuickEntry } from "@/features/transactions/QuickEntry";
import { RecentTransactions } from "@/features/transactions/RecentTransactions";
import { todayIn } from "@/lib/dates";
import { m } from "@/paraglide/messages";

interface DashboardPageProps {
	me: Profile;
	household: Household;
}

/**
 * Home of a signed-in user: the starting point of their household's pages.
 * On a phone, one column in the order of the page's code: the quick entry
 * first, then the key figures, the charts, what waits, what happened, and
 * the blocks showing only when they have something. On a wide screen, the
 * key figures across, then a main column (the charts side by side, what
 * waits, what happened) beside a narrower one (the quick entry on top, then
 * sharing, budgets, what comes).
 */
export function DashboardPage({ me, household }: DashboardPageProps) {
	const openDraft = useOpenDraft();
	return (
		<section className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:py-12">
			<header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
				<h1 className="font-heading font-semibold text-3xl">
					{m.dashboard_title()}
				</h1>
				<p className="flex flex-wrap gap-x-2 text-muted-foreground">
					<span>{m.dashboard_household({ name: household.name })}</span>
					<span aria-hidden>·</span>
					<span>{me.name || me.email}</span>
				</p>
			</header>
			<DemoBanner household={household} />
			<GettingStartedCard household={household} />
			{/* Placed explicitly on a wide screen: the quick entry, first in the
			code for a phone, goes to the top of the side column; the last row
			takes what is left of the main column's height, so nothing opens a
			gap under the quick entry */}
			<div className="grid items-start gap-6 lg:grid-cols-3 lg:grid-rows-[auto_auto_1fr]">
				<div className="lg:col-start-3 lg:row-start-2">
					<QuickEntry
						householdId={household.id}
						onDraft={(draft, photos) => openDraft(draft, { photos })}
					/>
				</div>
				<div className="lg:col-span-3 lg:row-start-1">
					<KeyFigures household={household} />
				</div>
				<div className="grid gap-6 lg:col-span-2 lg:col-start-1 lg:row-span-2 lg:row-start-2">
					<div className="grid items-start gap-6 md:grid-cols-2">
						<ExpenseBreakdownCard household={household} />
						<MonthlyExpensesCard household={household} />
					</div>
					<PendingRecurring household={household} />
					<RecentTransactions household={household} />
				</div>
				<div className="grid gap-6 lg:col-start-3 lg:row-start-3">
					{/* Only for the households that settle shared expenses */}
					{household.expenseSharing && (
						<SharingSummary household={household} meId={me.id} />
					)}
					<BudgetsOverview
						household={household}
						month={todayIn(household.timeZone).slice(0, 7)}
					/>
					<UpcomingRecurring household={household} />
					<InstallCard />
				</div>
			</div>
		</section>
	);
}
