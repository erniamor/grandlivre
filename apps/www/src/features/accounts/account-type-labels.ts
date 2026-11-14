import type { AccountType } from "@repo/schemas";
import { m } from "@/paraglide/messages";

export const accountTypeLabels: Record<AccountType, () => string> = {
	checking: m.account_type_checking,
	savings: m.account_type_savings,
	credit_card: m.account_type_credit_card,
	cash: m.account_type_cash,
	loan: m.account_type_loan,
	other: m.account_type_other,
};
