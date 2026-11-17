import type { DraftProblem } from "@/features/imports/import-draft";

/**
 * The attribute that marks a field still to correct: the first one in the
 * page is the first one on screen, whatever the form shows.
 */
export const CORRECTION_ATTRIBUTE = "data-correction";

/** Props marking a field's wrapper as still to correct, while `pending`. */
export function correctionMark(pending: boolean): Record<string, string> {
	return pending ? { [CORRECTION_ATTRIBUTE]: "" } : {};
}

/**
 * The account of the file whose field comes first among those to correct,
 * by its place; null when nothing is to correct in an account.
 */
export function firstCorrectionAccount(
	problems: DraftProblem[],
): number | null {
	for (const problem of problems) {
		if ("index" in problem) {
			return problem.index;
		}
	}
	return null;
}

/**
 * Brings the first field still to correct inside `root` into view, its
 * control focused. False when there is none.
 */
export function goToFirstCorrection(root: HTMLElement | null): boolean {
	const field = root?.querySelector<HTMLElement>(`[${CORRECTION_ATTRIBUTE}]`);
	if (!field) {
		return false;
	}
	// Not in every browser, nor in tests
	field.scrollIntoView?.({ behavior: "smooth", block: "center" });
	field
		.querySelector<HTMLElement>("input, select, textarea, button")
		?.focus({ preventScroll: true });
	return true;
}
