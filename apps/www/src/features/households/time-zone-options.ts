import { householdTimeZoneSchema } from "@repo/schemas";
import type { SelectOption } from "@/components/SelectField";

/** The browser's time zone, when the API can take it; else the API's default. */
export function browserTimeZone(): string | undefined {
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	return householdTimeZoneSchema.safeParse(timeZone).success
		? timeZone
		: undefined;
}

/**
 * The time zones the platform knows, as IANA names made readable
 * ("America/Toronto" as "America / Toronto"): no translation to maintain.
 * `current` is kept, even when the platform doesn't list it.
 */
export function timeZoneOptions(current: string): SelectOption<string>[] {
	const zones = Intl.supportedValuesOf("timeZone");
	return [...new Set([current, ...zones])]
		.sort((a, b) => a.localeCompare(b))
		.map((zone) => ({
			value: zone,
			label: zone.replaceAll("_", " ").replaceAll("/", " / "),
		}));
}
