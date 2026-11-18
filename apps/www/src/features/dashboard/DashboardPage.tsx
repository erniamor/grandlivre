import type { Household, Profile } from "@repo/schemas";
import { BudgetsOverview } from "@/features/budgets/BudgetsOverview";
import { ExpenseBreakdownCard } from "@/features/dashboard/ExpenseBreakdownCard";
import { KeyFigures } from "@/features/dashboard/KeyFigures";
import { MonthlyExpensesCard } from "@/features/dashboard/MonthlyExpensesCard";
import { GettingStartedCard } from "@/features/getting-started/GettingStartedCard";
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
 * On a wide screen, a main column (entering, what waits, what happened)
 * beside a narrower one (the month's expenses by tag and over twelve
 * months, sharing, budgets, what comes), under the key figures;
 * on a phone, one column, the main one first.
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
			<GettingStartedCard household={household} />
			<KeyFigures household={household} />
			<div className="grid items-start gap-6 lg:grid-cols-3">
				<div className="grid gap-6 lg:col-span-2">
					<QuickEntry
						householdId={household.id}
						onDraft={(draft, photos) => openDraft(draft, { photos })}
					/>
					<PendingRecurring household={household} />
					<RecentTransactions household={household} />
				</div>
				<div className="grid gap-6">
					{/* Always there, so the column never stands empty: the blocks
					under it show only when they have something */}
					<ExpenseBreakdownCard household={household} />
					<MonthlyExpensesCard household={household} />
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
