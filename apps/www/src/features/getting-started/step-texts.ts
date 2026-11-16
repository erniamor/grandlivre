import type { ShownStep } from "@/features/getting-started/getting-started-steps";
import { m } from "@/paraglide/messages";

/** What each step is called, and what it is for. */
export const stepTexts: Record<
	ShownStep,
	{ title: () => string; hint: () => string }
> = {
	tags: {
		title: m.getting_started_tags_title,
		hint: m.getting_started_tags_hint,
	},
	accounts: {
		title: m.getting_started_accounts_title,
		hint: m.getting_started_accounts_hint,
	},
	wallet: {
		title: m.getting_started_wallet_title,
		hint: m.getting_started_wallet_hint,
	},
	members: {
		title: m.getting_started_members_title,
		hint: m.getting_started_members_hint,
	},
	imported: {
		title: m.getting_started_imported_title,
		hint: m.getting_started_imported_hint,
	},
	recurring: {
		title: m.getting_started_recurring_title,
		hint: m.getting_started_recurring_hint,
	},
	budgets: {
		title: m.getting_started_budgets_title,
		hint: m.getting_started_budgets_hint,
	},
};
