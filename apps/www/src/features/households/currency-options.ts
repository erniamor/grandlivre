import { HOUSEHOLD_CURRENCIES, type HouseholdCurrency } from "@repo/schemas";
import type { SelectOption } from "@/components/SelectField";

export const DEFAULT_CURRENCY: HouseholdCurrency = "CAD";

/**
 * The currencies a household can use, named in `locale` by the platform
 * (e.g. "CAD · Canadian Dollar"): no translation to maintain.
 */
export function currencyOptions(
	locale: string,
): SelectOption<HouseholdCurrency>[] {
	const names = new Intl.DisplayNames([locale], { type: "currency" });
	return HOUSEHOLD_CURRENCIES.map((code) => ({
		value: code,
		label: `${code} · ${names.of(code) ?? code}`,
	}));
}
