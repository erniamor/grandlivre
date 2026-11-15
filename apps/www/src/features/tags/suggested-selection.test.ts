import type { SuggestedTag } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import {
	suggestedKeys,
	toggleSuggestion,
} from "@/features/tags/suggested-selection";

function suggestion(key: string, children: SuggestedTag[] = []): SuggestedTag {
	return { key, names: { en: key, fr: key, es: key }, children };
}

const tree = [
	suggestion("transport", [
		suggestion("transport/car", [
			suggestion("transport/car/gas"),
			suggestion("transport/car/tires"),
		]),
		suggestion("transport/train"),
	]),
	suggestion("leisure"),
	// Not under "transport": only a "/" separates a tag from its parent
	suggestion("transport-fees"),
];

const keys = suggestedKeys(tree);
const all = new Set(keys);

describe("suggestedKeys", () => {
	it("lists every key of the tree, in reading order", () => {
		expect(keys).toEqual([
			"transport",
			"transport/car",
			"transport/car/gas",
			"transport/car/tires",
			"transport/train",
			"leisure",
			"transport-fees",
		]);
	});
});

describe("toggleSuggestion", () => {
	it("unchecks a tag with everything under it, and nothing else", () => {
		expect(toggleSuggestion(all, keys, "transport/car", false)).toEqual(
			new Set(["transport", "transport/train", "leisure", "transport-fees"]),
		);
		expect(toggleSuggestion(all, keys, "transport", false)).toEqual(
			new Set(["leisure", "transport-fees"]),
		);
	});

	it("unchecks a tag without touching its siblings or its parent", () => {
		expect(toggleSuggestion(all, keys, "transport/car/gas", false)).toEqual(
			new Set(keys.filter((key) => key !== "transport/car/gas")),
		);
	});

	it("checks a tag with the tags above it", () => {
		expect(
			toggleSuggestion(new Set(["leisure"]), keys, "transport/car/gas", true),
		).toEqual(
			new Set(["leisure", "transport", "transport/car", "transport/car/gas"]),
		);
	});

	it("checks a tag with everything under it", () => {
		expect(toggleSuggestion(new Set(), keys, "transport/car", true)).toEqual(
			new Set([
				"transport",
				"transport/car",
				"transport/car/gas",
				"transport/car/tires",
			]),
		);
	});

	it("doesn't change the selection it was given", () => {
		const selected = new Set(["leisure"]);

		toggleSuggestion(selected, keys, "transport", true);

		expect(selected).toEqual(new Set(["leisure"]));
	});
});
