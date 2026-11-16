import type { Household } from "@repo/schemas";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useId } from "react";
import { GettingStartedStepItem } from "@/features/getting-started/GettingStartedStepItem";
import { gettingStartedQueryOptions } from "@/features/getting-started/getting-started-query";
import {
	gettingStartedSteps,
	progressOf,
} from "@/features/getting-started/getting-started-steps";
import { ShowOnDashboardButton } from "@/features/getting-started/ShowOnDashboardButton";
import { m } from "@/paraglide/messages";

interface GettingStartedPageProps {
	household: Household;
}

/**
 * A household's first steps, in order, each done or to do, leading to the
 * page that does it: where a new household lands.
 */
export function GettingStartedPage({ household }: GettingStartedPageProps) {
	const progressId = useId();
	const { data: status } = useSuspenseQuery(
		gettingStartedQueryOptions(household.id),
	);
	const steps = gettingStartedSteps(status, household.role);
	const { done, total } = progressOf(steps);

	return (
		<section className="mx-auto grid max-w-2xl gap-8 px-4 py-12">
			<header className="grid gap-2">
				<h1 className="font-heading font-semibold text-2xl">
					{m.getting_started_title()}
				</h1>
				<p className="text-muted-foreground">{m.getting_started_intro()}</p>
				<p id={progressId} className="text-sm">
					{m.getting_started_progress({ done, total })}
				</p>
				<progress
					aria-labelledby={progressId}
					value={done}
					max={total}
					className="h-2 w-full overflow-hidden rounded-full accent-primary"
				/>
			</header>
			<ol className="grid gap-3">
				{steps.map((step, index) => (
					<GettingStartedStepItem
						key={step.key}
						step={step}
						number={index + 1}
						household={household}
					/>
				))}
			</ol>
			<ShowOnDashboardButton household={household} hidden={status.hidden} />
		</section>
	);
}
