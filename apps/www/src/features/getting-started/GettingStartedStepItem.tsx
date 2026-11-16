import type { Household } from "@repo/schemas";
import { cn } from "@repo/ui";
import { CheckIcon } from "lucide-react";
import { useId } from "react";
import type { Step } from "@/features/getting-started/getting-started-steps";
import { StepActions } from "@/features/getting-started/StepActions";
import { stepTexts } from "@/features/getting-started/step-texts";
import { m } from "@/paraglide/messages";

interface GettingStartedStepItemProps {
	step: Step;
	/** Its place in the list, from 1. */
	number: number;
	household: Household;
}

/** A step: done or to do (in words, not only by its mark), what it is for, and where it leads. */
export function GettingStartedStepItem({
	step,
	number,
	household,
}: GettingStartedStepItemProps) {
	const titleId = useId();
	const { title, hint } = stepTexts[step.key];

	return (
		<li
			aria-labelledby={titleId}
			className={cn(
				"grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 rounded-lg border border-border p-4",
				step.done && "bg-muted",
			)}
		>
			<span
				aria-hidden
				className={cn(
					"flex size-7 items-center justify-center rounded-full border font-medium text-sm",
					step.done
						? "border-primary bg-primary text-primary-foreground"
						: "border-border",
				)}
			>
				{step.done ? <CheckIcon className="size-4" /> : number}
			</span>
			<div className="grid gap-1">
				<h2 id={titleId} className="font-medium">
					{title()}
				</h2>
				<p className="text-muted-foreground text-sm">
					{step.done
						? m.getting_started_step_done()
						: step.optional
							? m.getting_started_step_optional()
							: m.getting_started_step_todo()}
				</p>
				<p className="text-sm">{hint()}</p>
			</div>
			<div className="col-start-2 flex flex-wrap gap-2">
				<StepActions step={step} household={household} />
			</div>
		</li>
	);
}
