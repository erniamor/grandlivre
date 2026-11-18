import type { Household } from "@repo/schemas";
import { buttonVariants, cn } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
import { useId } from "react";
import { cardClass } from "@/components/card-styles";
import { gettingStartedQueryOptions } from "@/features/getting-started/getting-started-query";
import {
	gettingStartedSteps,
	nextStep,
	progressOf,
} from "@/features/getting-started/getting-started-steps";
import { stepTexts } from "@/features/getting-started/step-texts";
import { m } from "@/paraglide/messages";

interface GettingStartedCardProps {
	household: Household;
}

/**
 * The first steps on the dashboard: how far the household got, and the
 * next step. Gone once every step is done, or the user put it away.
 */
export function GettingStartedCard({ household }: GettingStartedCardProps) {
	const titleId = useId();
	const progressId = useId();
	// Not essential to the dashboard: it shows once read, never holds the page
	const { data: status } = useQuery(gettingStartedQueryOptions(household.id));
	if (!status || status.hidden) {
		return null;
	}
	const steps = gettingStartedSteps(status, household.role);
	const next = nextStep(steps);
	if (!next) {
		return null;
	}
	const { done, total } = progressOf(steps);

	return (
		<section aria-labelledby={titleId} className={cn("grid gap-3", cardClass)}>
			<h2 id={titleId} className="font-heading font-semibold text-lg">
				{m.getting_started_title()}
			</h2>
			<p id={progressId} className="text-sm">
				{m.getting_started_progress({ done, total })}
			</p>
			<progress
				aria-labelledby={progressId}
				value={done}
				max={total}
				className="h-2 w-full overflow-hidden rounded-full accent-primary"
			/>
			<p className="text-sm">
				{m.getting_started_next({ step: stepTexts[next.key].title() })}
			</p>
			<Link
				to="/getting-started"
				className={buttonVariants({ className: "justify-self-start" })}
			>
				{m.getting_started_continue()}
				<ArrowRightIcon aria-hidden />
			</Link>
		</section>
	);
}
