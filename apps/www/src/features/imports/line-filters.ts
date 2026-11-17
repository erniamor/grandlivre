import type { StatementPreviewLine } from "@repo/schemas";

/**
 * The filters of an account's lines:
 * - "fresh": new where they go, to decide;
 * - "known": already entered in the app (here, or a transfer's other side
 *   elsewhere), or recorded from the other side of the transfer, in the file;
 * - "recurring": a recurring day waiting for them;
 * - "imported": imported before, left as they are.
 */
export const LINE_FILTERS = [
	"fresh",
	"known",
	"recurring",
	"imported",
] as const;

export type LineFilter = (typeof LINE_FILTERS)[number];

/** A line as the filters read it: what it is where its account goes, and whether its pair records it. */
export interface FilteredLine {
	line: StatementPreviewLine;
	status: StatementPreviewLine["status"];
	paired: boolean;
}

/** The filter a line belongs to. */
export function filterOf({ status, paired }: FilteredLine): LineFilter {
	switch (status) {
		case "imported":
			return "imported";
		case "recurring":
			return "recurring";
		case "matched":
		case "counterpart":
			return "known";
		default:
			return paired ? "known" : "fresh";
	}
}

/** How many lines each filter holds. */
export function countByFilter(
	lines: FilteredLine[],
): Record<LineFilter, number> {
	const counts = { fresh: 0, known: 0, recurring: 0, imported: 0 };
	for (const line of lines) {
		counts[filterOf(line)] += 1;
	}
	return counts;
}

/** The filter shown first: the lines to decide, else the first that holds some. */
export function defaultFilter(counts: Record<LineFilter, number>): LineFilter {
	return LINE_FILTERS.find((filter) => counts[filter] > 0) ?? "fresh";
}

/** A text's letters and digits, without accents nor case: "Dépôt" is "depot". */
function searchable(text: string): string {
	return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * The lines shown: those of the filter whose payee or description holds
 * the search (accents and case aside), and always those still to correct,
 * so the way to the first correction finds them.
 */
export function visibleLines(
	lines: FilteredLine[],
	filter: LineFilter,
	search: string,
	toCorrect: ReadonlySet<string>,
): FilteredLine[] {
	const searched = searchable(search.trim());
	return lines.filter(
		(each) =>
			toCorrect.has(each.line.externalId) ||
			(filterOf(each) === filter &&
				(searched === "" ||
					searchable(`${each.line.payee} ${each.line.description}`).includes(
						searched,
					))),
	);
}
