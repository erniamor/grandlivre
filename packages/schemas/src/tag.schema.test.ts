import { describe, expect, it } from "vitest";
import {
	createTagSchema,
	TAG_NAME_MAX_LENGTH,
	tagDisplayName,
	updateTagSchema,
} from "./tag.schema";

function messages(result: { error?: { issues: { message: string }[] } }) {
	return result.error?.issues.map((issue) => issue.message) ?? [];
}

const PARENT = "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f";

describe("createTagSchema", () => {
	it("accepts a name in one language, trimmed, at the root by default", () => {
		expect(createTagSchema.parse({ names: { fr: "  Essence " } })).toEqual({
			names: { fr: "Essence" },
		});
	});

	it("accepts a name per language and a parent", () => {
		const tag = {
			names: { en: "Gas", fr: "Essence", es: "Gasolina" },
			parentId: PARENT,
		};

		expect(createTagSchema.parse(tag)).toEqual(tag);
		expect(createTagSchema.parse({ ...tag, parentId: null })).toEqual({
			...tag,
			parentId: null,
		});
	});

	it("rejects a tag without any name", () => {
		expect(messages(createTagSchema.safeParse({ names: {} }))).toEqual([
			"tag_name_required",
		]);
	});

	it("rejects a blank or too long name, in the language concerned", () => {
		const result = createTagSchema.safeParse({
			names: { en: "Gas", fr: " ", es: "a".repeat(TAG_NAME_MAX_LENGTH + 1) },
		});

		expect(
			result.error?.issues.map((issue) => [
				issue.path.join("."),
				issue.message,
			]),
		).toEqual([
			["names.fr", "tag_name_required"],
			["names.es", "tag_name_too_long"],
		]);
	});

	it("rejects an unknown language, and a parent that isn't an id", () => {
		expect(
			createTagSchema.safeParse({ names: { en: "Gas", de: "Benzin" } }).success,
		).toBe(false);
		expect(
			messages(
				createTagSchema.safeParse({ names: { en: "Gas" }, parentId: "car" }),
			),
		).toEqual(["tag_parent_invalid"]);
	});
});

describe("updateTagSchema", () => {
	it("accepts any subset of the fields", () => {
		expect(updateTagSchema.parse({ parentId: null })).toEqual({
			parentId: null,
		});
		expect(updateTagSchema.parse({ names: { en: "Fuel" } })).toEqual({
			names: { en: "Fuel" },
		});
		expect(updateTagSchema.parse({})).toEqual({});
	});

	it("still requires a name when the names are sent", () => {
		expect(messages(updateTagSchema.safeParse({ names: {} }))).toEqual([
			"tag_name_required",
		]);
	});
});

describe("tagDisplayName", () => {
	it("is the name in the user's language", () => {
		expect(tagDisplayName({ en: "Gas", fr: "Essence" }, "fr")).toBe("Essence");
	});

	it("falls back to another language's name", () => {
		expect(tagDisplayName({ fr: "Essence" }, "en")).toBe("Essence");
		expect(tagDisplayName({ en: "Gas", fr: "Essence" }, "es")).toBe("Gas");
	});
});
