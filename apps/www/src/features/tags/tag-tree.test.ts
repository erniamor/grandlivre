import type { Tag } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import {
	buildTagTree,
	flattenTagTree,
	subtreeIds,
	type TagNode,
} from "@/features/tags/tag-tree";

function tag(
	id: string,
	names: Tag["names"],
	parentId: string | null = null,
): Tag {
	return {
		id,
		householdId: "household",
		names,
		parentId,
		createdAt: "2026-11-14T12:00:00.000Z",
	};
}

const tags = [
	tag("home", { en: "Home", fr: "Maison" }),
	tag("internet", { en: "Internet" }, "home"),
	tag("mortgage", { en: "Mortgage", fr: "Hypothèque" }, "home"),
	tag("car", { en: "Car", fr: "Voiture" }),
	tag("gas", { fr: "Essence" }, "car"),
	tag("electricity", { en: "Electricity", fr: "Électricité" }, "home"),
];

/** The tree as nested names. */
const outline = (nodes: TagNode[]): unknown[] =>
	nodes.map((node) =>
		node.children.length > 0 ? [node.name, outline(node.children)] : node.name,
	);

describe("buildTagTree", () => {
	it("nests the tags under their parent, each level sorted by name", () => {
		expect(outline(buildTagTree(tags, "en"))).toEqual([
			["Car", ["Essence"]],
			["Home", ["Electricity", "Internet", "Mortgage"]],
		]);
	});

	it("names and sorts the tags in the user's language, accents included", () => {
		expect(outline(buildTagTree(tags, "fr"))).toEqual([
			["Maison", ["Électricité", "Hypothèque", "Internet"]],
			["Voiture", ["Essence"]],
		]);
	});

	it("shows a tag whose parent is missing at the root", () => {
		expect(
			outline(buildTagTree([tag("gas", { en: "Gas" }, "gone")], "en")),
		).toEqual(["Gas"]);
	});

	it("is empty without tags", () => {
		expect(buildTagTree([], "en")).toEqual([]);
	});
});

describe("flattenTagTree", () => {
	it("lists the tags in reading order, with the path leading to each", () => {
		expect(
			flattenTagTree(buildTagTree(tags, "en")).map(({ tag, path }) => [
				tag.id,
				path,
			]),
		).toEqual([
			["car", "Car"],
			["gas", "Car › Essence"],
			["home", "Home"],
			["electricity", "Home › Electricity"],
			["internet", "Home › Internet"],
			["mortgage", "Home › Mortgage"],
		]);
	});
});

describe("subtreeIds", () => {
	it("is the tag and every tag under it, at any depth", () => {
		const deep = [...tags, tag("fiber", { en: "Fiber" }, "internet")];

		expect(subtreeIds(deep, "home")).toEqual(
			new Set(["home", "internet", "mortgage", "electricity", "fiber"]),
		);
		expect(subtreeIds(deep, "gas")).toEqual(new Set(["gas"]));
	});
});
