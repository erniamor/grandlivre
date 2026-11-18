import { m } from "@/paraglide/messages";

/** Tells a demo household apart, wherever its name shows. */
export function DemoBadge() {
	return (
		<span className="shrink-0 rounded-full border border-current px-1.5 font-medium text-[0.65rem] uppercase leading-4 tracking-wide opacity-80">
			{m.demo_badge()}
		</span>
	);
}
