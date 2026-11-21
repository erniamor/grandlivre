import { matchesSearch, searchWords } from "@/lib/search";
import { m } from "@/paraglide/messages";

/** A question asked often, and its answer. */
export interface FaqItem {
	question: () => string;
	answer: () => string;
}

export const faq: FaqItem[] = [
	{ question: m.faq_visibility_q, answer: m.faq_visibility_a },
	{ question: m.faq_cash_q, answer: m.faq_cash_a },
	{ question: m.faq_card_q, answer: m.faq_card_a },
	{ question: m.faq_import_twice_q, answer: m.faq_import_twice_a },
	{
		question: m.faq_entered_then_imported_q,
		answer: m.faq_entered_then_imported_a,
	},
	{ question: m.faq_undetermined_q, answer: m.faq_undetermined_a },
	{ question: m.faq_receipt_kept_q, answer: m.faq_receipt_kept_a },
	{ question: m.faq_voice_q, answer: m.faq_voice_a },
	{ question: m.faq_file_kept_q, answer: m.faq_file_kept_a },
	{ question: m.faq_undo_import_q, answer: m.faq_undo_import_a },
	{ question: m.faq_delete_q, answer: m.faq_delete_a },
	{ question: m.faq_currency_q, answer: m.faq_currency_a },
	{ question: m.faq_households_q, answer: m.faq_households_a },
	{ question: m.faq_private_q, answer: m.faq_private_a },
	{ question: m.faq_demo_q, answer: m.faq_demo_a },
	{ question: m.faq_language_q, answer: m.faq_language_a },
];

/**
 * The questions whose question or answer holds every word searched (the
 * start of a word is enough: "rel" finds "relevé"), accents and case aside.
 * All of them for an empty search.
 */
export function searchFaq(items: FaqItem[], search: string): FaqItem[] {
	const searched = searchWords(search);
	if (searched.length === 0) {
		return items;
	}
	return items.filter((item) =>
		matchesSearch(`${item.question()} ${item.answer()}`, searched),
	);
}
