/** A text's words, without accents nor case: "Dépôt" is "depot". */
export function searchWords(text: string): string[] {
	return text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter(Boolean);
}

/**
 * Whether `text` holds every word of `searched` (from `searchWords()`), the
 * start of a word being enough: "rel" finds "relevé".
 */
export function matchesSearch(text: string, searched: string[]): boolean {
	const words = searchWords(text);
	return searched.every((part) => words.some((word) => word.startsWith(part)));
}
