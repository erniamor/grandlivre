import type { Household } from "@repo/schemas";
import { FlaskConicalIcon } from "lucide-react";
import { DemoHouseholdActions } from "@/features/households/DemoHouseholdActions";
import { m } from "@/paraglide/messages";

interface DemoBannerProps {
	household: Household;
}

/** Says a demo household's data is made up, with the way to start over or delete it; nothing for a real one. */
export function DemoBanner({ household }: DemoBannerProps) {
	if (!household.demo) {
		return null;
	}
	return (
		<aside
			aria-label={m.demo_badge()}
			className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border border-dashed bg-muted/40 p-4"
		>
			<p className="flex items-start gap-2 text-sm">
				<FlaskConicalIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
				{m.demo_banner()}
			</p>
			<DemoHouseholdActions household={household} />
		</aside>
	);
}
