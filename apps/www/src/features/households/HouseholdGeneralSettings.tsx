import type { Household } from "@repo/schemas";
import { buttonVariants } from "@repo/ui";
import { Link } from "@tanstack/react-router";
import { ListChecksIcon } from "lucide-react";
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
