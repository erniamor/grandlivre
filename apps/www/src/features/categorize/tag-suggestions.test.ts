import type { UncategorizedPayee } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import {
	nextToAsk,
	shownTag,
	tagsToApply,
	withSuggestions,
} from "@/features/categorize/tag-suggestions";

const payee = (key: string): UncategorizedPayee => ({
	key,
	payee: key.toUpperCase(),
	type: "expense",
	count: 1,
	total: 10_00,
	firstDate: "2026-10-01",
	lastDate: "2026-10-01",
});

describe("nextToAsk", () => {
	it("takes the payees not asked yet, in order, 50 at most", () => {
		const groups = Array.from({ length: 60 }, (_, index) => payee(`p${index}`));
		const asked = withSuggestions(new Map(), groups.slice(0, 5), {
			suggestions: [],
		});

		const next = nextToAsk(groups, asked);

		expect(next).toHaveLength(50);
		expect(next[0]?.key).toBe("p5");
	});
});

describe("shownTag and tagsToApply", () => {
	const fuel = payee("shell");
	const saaq = payee("saaq");
	const gone = payee("gone");
	const suggestions = withSuggestions(new Map(), [fuel, saaq, gone], {
		suggestions: [
			{ key: "shell", type: "expense", tagId: "fuel" },
			{ key: "gone", type: "expense", tagId: "deleted" },
		],
	});
	const tagIds = new Set(["fuel", "car"]);

	it("shows the user's choice first, else the assistant's tag if it still exists", () => {
		expect(shownTag(fuel, new Map(), suggestions, tagIds)).toEqual({
			tagId: "fuel",
			suggested: true,
		});
		expect(
			shownTag(fuel, new Map([["expense:shell", "car"]]), suggestions, tagIds),
		).toEqual({ tagId: "car", suggested: false });
		// Cleared by the user: none
		expect(
			shownTag(fuel, new Map([["expense:shell", ""]]), suggestions, tagIds),
		).toEqual({ tagId: "", suggested: false });
		// No answer, or a tag deleted since
		expect(shownTag(saaq, new Map(), suggestions, tagIds).tagId).toBe("");
		expect(shownTag(gone, new Map(), suggestions, tagIds).tagId).toBe("");
	});

	it("applies the payees a tag shows for", () => {
		expect(
			tagsToApply(
				[fuel, saaq, gone],
				new Map([["expense:saaq", "car"]]),
				suggestions,
				tagIds,
			).map(({ group, tagId }) => [group.key, tagId]),
		).toEqual([
			["shell", "fuel"],
			["saaq", "car"],
		]);
	});
});
