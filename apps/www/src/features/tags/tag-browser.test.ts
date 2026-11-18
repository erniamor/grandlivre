import type { Tag } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import {
	searchTags,
	tagLevel,
	tagPath,
	trailTo,
} from "@/features/tags/tag-browser";
import { buildTagTree } from "@/features/tags/tag-tree";

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

const tree = buildTagTree(
	[
		tag("home", { en: "Home", fr: "Maison" }),
		tag("home-insurance", { en: "Insurance", fr: "Assurance" }, "home"),
		tag("internet", { en: "Internet" }, "home"),
		tag("fiber", { en: "Fiber", fr: "Fibre" }, "internet"),
		tag("car", { en: "Car", fr: "Voiture" }),
		tag("car-insurance", { en: "Insurance", fr: "Assurance" }, "car"),
	],
	"fr",
);
const names = (nodes: { name: string }[]) => nodes.map(({ name }) => name);

describe("tagLevel", () => {
	it("lists the root tags, then the child tags of each one opened", () => {
		expect(names(tagLevel(tree, []).children)).toEqual(["Maison", "Voiture"]);

		const level = tagLevel(tree, ["home", "internet"]);
		expect(names(level.trail)).toEqual(["Maison", "Internet"]);
		expect(names(level.children)).toEqual(["Fibre"]);
	});

	it("stops where a tag of the trail is gone", () => {
		const level = tagLevel(tree, ["home", "deleted", "fiber"]);

		expect(names(level.trail)).toEqual(["Maison"]);
		expect(names(level.children)).toEqual(["Assurance", "Internet"]);
	});
});

describe("trailTo", () => {
	it("opens the level that lists a tag", () => {
		expect(trailTo(tree, "fiber")).toEqual(["home", "internet"]);
		expect(trailTo(tree, "car")).toEqual([]);
	});

	it("starts at the root without a tag, or for one not found", () => {
		expect(trailTo(tree, null)).toEqual([]);
		expect(trailTo(tree, "deleted")).toEqual([]);
	});
});

describe("searchTags", () => {
	it("finds a tag at any level, with its path to tell apart the same names", () => {
		expect(searchTags(tree, "assur").map(({ path }) => path)).toEqual([
			"Maison › Assurance",
			"Voiture › Assurance",
		]);
	});

	it("matches every word against the path, accents and case aside", () => {
		expect(searchTags(tree, "VOIT assu").map(({ tag }) => tag.id)).toEqual([
			"car-insurance",
		]);
		expect(searchTags(tree, "fibré").map(({ tag }) => tag.id)).toEqual([
			"fiber",
		]);
	});

	it("finds nothing for an empty search: the levels show instead", () => {
		expect(searchTags(tree, "  ")).toEqual([]);
	});
});

describe("tagPath", () => {
	it("names a tag with the names leading to it", () => {
		expect(tagPath(tree, "fiber")).toBe("Maison › Internet › Fibre");
		expect(tagPath(tree, null)).toBeNull();
	});
});
