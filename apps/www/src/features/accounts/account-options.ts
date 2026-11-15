import {
	ACCOUNT_TYPES,
	type AccountType,
	type AccountVisibility,
} from "@repo/schemas";
import type { SelectOption } from "@/components/SelectField";
import { accountTypeLabels } from "@/features/accounts/account-type-labels";
import { m } from "@/paraglide/messages";

export function accountTypeOptions(): SelectOption<AccountType>[] {
	return ACCOUNT_TYPES.map((type) => ({
		value: type,
		label: accountTypeLabels[type](),
	}));
}

export function accountVisibilityOptions(): SelectOption<AccountVisibility>[] {
	return [
		{ value: "details", label: m.account_visibility_details() },
		{ value: "balance", label: m.account_visibility_balance() },
	];
}
