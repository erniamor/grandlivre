import type { Household } from "@repo/schemas";
import { Button } from "@repo/ui";
import { RotateCcwIcon } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useDemoHousehold } from "@/features/households/use-demo-household";
import { m } from "@/paraglide/messages";

interface DemoHouseholdActionsProps {
	household: Household;
}

/** Starts the demo over, with fresh made-up data, or deletes it, after a confirmation. */
export function DemoHouseholdActions({ household }: DemoHouseholdActionsProps) {
	const demo = useDemoHousehold();
	const busy = demo.creating || demo.removing;

	return (
		<div className="flex flex-wrap gap-2">
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={busy}
				onClick={() => demo.create(household.currency)}
			>
				<RotateCcwIcon aria-hidden />
				{demo.creating ? m.demo_restarting() : m.demo_restart()}
			</Button>
			{household.role === "owner" && (
				<ConfirmButton
					label={m.demo_delete()}
					title={m.demo_delete_title()}
					description={m.demo_delete_text()}
					confirmLabel={m.demo_delete_confirm()}
					pending={busy}
					onConfirm={() => demo.remove(household.id)}
				/>
			)}
		</div>
	);
}
