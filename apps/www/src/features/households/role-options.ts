import type { HouseholdRole } from "@repo/schemas";
import type { SelectOption } from "@/components/SelectField";
import { m } from "@/paraglide/messages";

export const roleLabels: Record<HouseholdRole, () => string> = {
	owner: m.role_owner,
	member: m.role_member,
};

export function roleOptions(): SelectOption<HouseholdRole>[] {
	return [
		{ value: "owner", label: roleLabels.owner() },
		{ value: "member", label: roleLabels.member() },
	];
}
