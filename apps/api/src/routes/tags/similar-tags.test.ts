import { describe, expect, it } from "vitest";
import { findSimilarTags, normalizeTagName } from "@/routes/tags/similar-tags";

describe("normalizeTagName", () => {
	it("leaves out case, accents, punctuation and plural", () => {
		expect(normalizeTagName("  Péages ")).toBe("peage");
		expect(normalizeTagName("Assurance-auto")).toBe("assurance auto");
		expect(normalizeTagName("Frais bancaires")).toBe("frai bancaire");
		expect(normalizeTagName("Gas")).toBe("gas");
	});
});

describe("findSimilarTags", () => {
	const tags = [
		{ id: "insurance", names: { en: "Car insurance", fr: "Assurance auto" } },
		{ id: "tolls", names: { en: "Tolls", fr: "Péages" } },
		{ id: "gas", names: { en: "Gas", fr: "Essence" } },
		{ id: "home", names: { fr: "Maison" } },
	];

	it("finds a tag of the same name, in any language", () => {
		expect(findSimilarTags(["Peage", "Toll"], tags)).toEqual([
			{ tagId: "tolls", reason: "same_name" },
		]);
	});

	it("finds a name a typo away", () => {
		expect(findSimilarTags(["Assurence auto"], tags)).toEqual([
			{ tagId: "insurance", reason: "similar_name" },
		]);
	});

	it("finds a name that holds the other", () => {
		expect(findSimilarTags(["Assurance"], tags)).toEqual([
			{ tagId: "insurance", reason: "contains" },
		]);
	});

	it("puts the closest first", () => {
		expect(
			findSimilarTags(["Essence", "Assurance"], tags).map((each) => each.tagId),
		).toEqual(["gas", "insurance"]);
	});

	it("doesn't confuse short names that differ", () => {
		expect(findSimilarTags(["Car", "Cat"], tags)).toEqual([]);
		expect(findSimilarTags(["Garden"], tags)).toEqual([]);
	});
});
