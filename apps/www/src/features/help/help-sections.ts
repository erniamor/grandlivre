import { m } from "@/paraglide/messages";

/** A section of the help page: its anchor, its title, its paragraphs. */
export interface HelpSection {
	/** Its anchor on the page: `/help#accounts`. */
	id: HelpSectionId;
	title: () => string;
	paragraphs: (() => string)[];
}

/** The sections, in the order the app is used. */
export const HELP_SECTION_IDS = [
	"getting-started",
	"accounts",
	"transactions",
	"quick-entry",
	"imports",
	"sorting",
	"recurring",
	"budgets",
	"reports",
	"sharing",
	"app",
] as const;

export type HelpSectionId = (typeof HELP_SECTION_IDS)[number];

export const helpSections: HelpSection[] = [
	{
		id: "getting-started",
		title: m.help_section_getting_started_title,
		paragraphs: [
			m.help_section_getting_started_p1,
			m.help_section_getting_started_p2,
			m.help_section_getting_started_p3,
		],
	},
	{
		id: "accounts",
		title: m.help_section_accounts_title,
		paragraphs: [
			m.help_section_accounts_p1,
			m.help_section_accounts_p2,
			m.help_section_accounts_p3,
			m.help_section_accounts_p4,
		],
	},
	{
		id: "transactions",
		title: m.help_section_transactions_title,
		paragraphs: [
			m.help_section_transactions_p1,
			m.help_section_transactions_p2,
			m.help_section_transactions_p3,
		],
	},
	{
		id: "quick-entry",
		title: m.help_section_quick_entry_title,
		paragraphs: [
			m.help_section_quick_entry_p1,
			m.help_section_quick_entry_p2,
			m.help_section_quick_entry_p3,
		],
	},
	{
		id: "imports",
		title: m.help_section_imports_title,
		paragraphs: [
			m.help_section_imports_p1,
			m.help_section_imports_p2,
			m.help_section_imports_p3,
		],
	},
	{
		id: "sorting",
		title: m.help_section_sorting_title,
		paragraphs: [m.help_section_sorting_p1, m.help_section_sorting_p2],
	},
	{
		id: "recurring",
		title: m.help_section_recurring_title,
		paragraphs: [
			m.help_section_recurring_p1,
			m.help_section_recurring_p2,
			m.help_section_recurring_p3,
		],
	},
	{
		id: "budgets",
		title: m.help_section_budgets_title,
		paragraphs: [m.help_section_budgets_p1],
	},
	{
		id: "reports",
		title: m.help_section_reports_title,
		paragraphs: [m.help_section_reports_p1],
	},
	{
		id: "sharing",
		title: m.help_section_sharing_title,
		paragraphs: [m.help_section_sharing_p1],
	},
	{
		id: "app",
		title: m.help_section_app_title,
		paragraphs: [m.help_section_app_p1],
	},
];
