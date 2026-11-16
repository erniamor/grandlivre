import { describe, expect, it } from "vitest";
import { type FaqItem, searchFaq } from "@/features/help/faq";

const item = (question: string, answer: string): FaqItem => ({
	question: () => question,
	answer: () => answer,
});

const items = [
	item("Mon relevé est-il gardé ?", "Non, le fichier est oublié une fois lu."),
	item("Comment annuler un import ?", "Défaites-le depuis la page d'import."),
	item(
		"Pourquoi le solde de ma carte est négatif ?",
		"Une carte doit de l'argent.",
	),
];

describe("searchFaq", () => {
	it("finds the questions holding every word, in the question or the answer", () => {
		expect(searchFaq(items, "import").map((each) => each.question())).toEqual([
			"Comment annuler un import ?",
		]);
		expect(searchFaq(items, "carte solde")).toHaveLength(1);
		expect(searchFaq(items, "carte import")).toEqual([]);
	});

	it("ignores accents and case, and takes the start of a word", () => {
		expect(searchFaq(items, "RELEVE")).toHaveLength(1);
		expect(searchFaq(items, "rel")).toHaveLength(1);
		expect(searchFaq(items, "negat")).toHaveLength(1);
	});

	it("keeps them all for an empty search", () => {
		expect(searchFaq(items, "  ")).toEqual(items);
	});
});
