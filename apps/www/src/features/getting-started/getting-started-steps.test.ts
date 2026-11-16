import type { GettingStarted } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import {
	gettingStartedSteps,
	nextStep,
	progressOf,
} from "@/features/getting-started/getting-started-steps";

const status = (steps: Partial<GettingStarted["steps"]>): GettingStarted => ({
	hidden: false,
	steps: {
		tags: false,
		accounts: false,
		wallet: false,
		members: false,
		imported: false,
		categorized: true,
		recurring: false,
		budgets: false,
		...steps,
	},
	uncategorized: 0,
});

describe("gettingStartedSteps", () => {
	it("lists the steps in order, inviting members for the owners only", () => {
		expect(
			gettingStartedSteps(status({}), "owner").map((step) => step.key),
		).toEqual([
			"tags",
			"accounts",
			"wallet",
			"members",
			"imported",
			"recurring",
			"budgets",
		]);
		expect(
			gettingStartedSteps(status({}), "member").map((step) => step.key),
		).not.toContain("members");
	});

	it("counts the steps done, and points to the next one, the needed ones first", () => {
		const steps = gettingStartedSteps(
			status({ tags: true, wallet: true }),
			"member",
		);

		expect(progressOf(steps)).toEqual({ done: 2, total: 6 });
		expect(nextStep(steps)?.key).toBe("accounts");
		expect(
			nextStep(
				gettingStartedSteps(
					status({ tags: true, accounts: true, imported: true }),
					"member",
				),
			)?.key,
		).toBe("wallet");
		expect(
			nextStep(
				gettingStartedSteps(
					status({
						tags: true,
						accounts: true,
						wallet: true,
						imported: true,
						recurring: true,
						budgets: true,
					}),
					"member",
				),
			),
		).toBeNull();
	});
});
