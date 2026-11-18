import type { Household } from "@repo/schemas";
import { buttonVariants } from "@repo/ui";
import { Link } from "@tanstack/react-router";
import { ListChecksIcon } from "lucide-react";
import { DemoHouseholdActions } from "@/features/households/DemoHouseholdActions";
import { HouseholdCurrencyField } from "@/features/households/HouseholdCurrencyField";
import { HouseholdNameField } from "@/features/households/HouseholdNameField";
import { HouseholdSharingField } from "@/features/households/HouseholdSharingField";
import { HouseholdTimeZoneField } from "@/features/households/HouseholdTimeZoneField";
import { m } from "@/paraglide/messages";

interface HouseholdGeneralSettingsProps {
	household: Household;
}

/** The household's general settings: its name, currency, time zone and expense sharing. */
export function HouseholdGeneralSettings({
	household,
}: HouseholdGeneralSettingsProps) {
	return (
		<>
			{household.demo && (
				<section className="grid gap-2 rounded-lg border border-border border-dashed p-4">
					<h2 className="font-heading font-semibold text-lg">
						{m.demo_settings_title()}
					</h2>
					<p className="text-muted-foreground text-sm">
						{m.demo_settings_text()}
					</p>
					<DemoHouseholdActions household={household} />
				</section>
			)}
			<div className="grid gap-4">
				<HouseholdNameField household={household} />
				<HouseholdCurrencyField household={household} />
				<HouseholdTimeZoneField household={household} />
				<HouseholdSharingField household={household} />
			</div>
			<Link
				to="/getting-started"
				className={buttonVariants({
					variant: "outline",
					className: "justify-self-start",
				})}
			>
				<ListChecksIcon aria-hidden />
				{m.getting_started_link()}
			</Link>
		</>
	);
}
