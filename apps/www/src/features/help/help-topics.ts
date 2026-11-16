import { m } from "@/paraglide/messages";

/** A notion explained where it shows: what its "?" is called, and what it says. */
export interface HelpTopic {
	/** The "?" button's name: "What is the visibility?". */
	label: () => string;
	title: () => string;
	text: () => string;
}

const topic = (
	label: () => string,
	title: () => string,
	text: () => string,
): HelpTopic => ({ label, title, text });

/** The notions explained in place, with a "?". */
export const helpTopics = {
	accountVisibility: topic(
		m.help_account_visibility_label,
		m.help_account_visibility_title,
		m.help_account_visibility_text,
	),
	accountHolders: topic(
		m.help_account_holders_label,
		m.help_account_holders_title,
		m.help_account_holders_text,
	),
	openingBalance: topic(
		m.help_opening_balance_label,
		m.help_opening_balance_title,
		m.help_opening_balance_text,
	),
	amountOwed: topic(
		m.help_amount_owed_label,
		m.help_amount_owed_title,
		m.help_amount_owed_text,
	),
	consolidatedView: topic(
		m.help_consolidated_view_label,
		m.help_consolidated_view_title,
		m.help_consolidated_view_text,
	),
	transfer: topic(
		m.help_transfer_label,
		m.help_transfer_title,
		m.help_transfer_text,
	),
	lines: topic(m.help_lines_label, m.help_lines_title, m.help_lines_text),
	adjustBalance: topic(
		m.help_adjust_balance_label,
		m.help_adjust_balance_title,
		m.help_adjust_balance_text,
	),
	recurringMode: topic(
		m.help_recurring_mode_label,
		m.help_recurring_mode_title,
		m.help_recurring_mode_text,
	),
	budgetPeriod: topic(
		m.help_budget_period_label,
		m.help_budget_period_title,
		m.help_budget_period_text,
	),
	importKnown: topic(
		m.help_import_known_label,
		m.help_import_known_title,
		m.help_import_known_text,
	),
	importFile: topic(
		m.help_import_file_label,
		m.help_import_file_title,
		m.help_import_file_text,
	),
	sharingSplit: topic(
		m.help_sharing_split_label,
		m.help_sharing_split_title,
		m.help_sharing_split_text,
	),
} satisfies Record<string, HelpTopic>;

export type HelpTopicKey = keyof typeof helpTopics;
