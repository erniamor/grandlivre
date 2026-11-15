import {
	LOCALES,
	MAX_TAGS_PER_HOUSEHOLD,
	type SuggestedTag,
} from "@repo/schemas";
import { describe, expect, it } from "vitest";
import { suggestedTags } from "@/routes/tags/suggested-tags";

/** Every level of the tree: the root, then the children of each tag. */
function levels(suggestions: SuggestedTag[]): SuggestedTag[][] {
	return [
		suggestions,
		...suggestions.flatMap(({ children }) =>
			children.length > 0 ? levels(children) : [],
		),
	];
}

const all = levels(suggestedTags).flat();

describe("suggestedTags", () => {
	it("names every tag in every language", () => {
		for (const { key, names } of all) {
			for (const locale of LOCALES) {
				expect(names[locale].trim(), `${key} in ${locale}`).not.toBe("");
			}
		}
	});

	it("gives each tag a distinct name among its siblings, in every language", () => {
		for (const level of levels(suggestedTags)) {
			for (const locale of LOCALES) {
				const names = level.map(({ names }) => names[locale].toLowerCase());
				const repeated = names.filter(
					(name, index) => names.indexOf(name) !== index,
				);
				expect(repeated, `${locale} under ${level[0]?.key}`).toEqual([]);
			}
		}
	});

	it("gives each tag a unique key that starts with its parent's", () => {
		const keys = all.map(({ key }) => key);

		expect(new Set(keys).size).toBe(keys.length);
		for (const { key, children } of all) {
			for (const child of children) {
				expect(child.key.startsWith(`${key}/`), child.key).toBe(true);
			}
		}
	});

	it("fits in a household, with room for its own tags", () => {
		expect(all.length).toBeGreaterThan(100);
		expect(all.length).toBeLessThan(MAX_TAGS_PER_HOUSEHOLD / 2);
	});
});
