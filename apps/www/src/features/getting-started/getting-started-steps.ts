import type { GettingStarted, HouseholdRole } from "@repo/schemas";

/** The steps shown, in order: the categorizing of the history comes with its page. */
export const SHOWN_STEPS = [
	"tags",
	"accounts",
	"wallet",
	"members",
	"imported",
	"recurring",
	"budgets",
] as const;

export type ShownStep = (typeof SHOWN_STEPS)[number];

/** Steps a household may well do without. */
const OPTIONAL: readonly ShownStep[] = [
	"wallet",
	"members",
	"recurring",
	"budgets",
];

export interface Step {
	key: ShownStep;
	done: boolean;
	optional: boolean;
}

/**
 * The steps the user sees, in order: inviting members is for the owners,
 * who manage the household's members.
 */
export function gettingStartedSteps(
	status: GettingStarted,
	role: HouseholdRole,
): Step[] {
	return SHOWN_STEPS.filter((key) => key !== "members" || role === "owner").map(
		(key) => ({
			key,
			done: status.steps[key],
			optional: OPTIONAL.includes(key),
		}),
	);
}

/** How many steps are done, of how many. */
export function progressOf(steps: Step[]): { done: number; total: number } {
	return {
		done: steps.filter((step) => step.done).length,
		total: steps.length,
	};
}

/** The next step to do: the first one left that isn't optional, else the first one left. */
export function nextStep(steps: Step[]): Step | null {
	return (
		steps.find((step) => !step.done && !step.optional) ??
		steps.find((step) => !step.done) ??
		null
	);
}
