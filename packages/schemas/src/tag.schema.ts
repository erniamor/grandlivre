import { z } from "zod";
import { dateTimeSchema, LOCALES, type Locale } from "./common";

export const TAG_NAME_MAX_LENGTH = 40;

/** Tags a household can have: its whole tree fits in one page of the API. */
export const MAX_TAGS_PER_HOUSEHOLD = 500;

// Error messages are codes, translated by the front ends.
// trim(): a name made only of spaces counts as empty.
export const tagNameSchema = z
	.string()
	.trim()
	.min(1, "tag_name_required")
	.max(TAG_NAME_MAX_LENGTH, "tag_name_too_long");

/**
 * The name of a tag in each language: members of a household can use
 * different ones. At least one is given; a missing language falls back to
 * another one's name (`tagDisplayName()`).
 */
export const tagNamesSchema = z
	.strictObject({
		en: tagNameSchema.optional(),
		fr: tagNameSchema.optional(),
		es: tagNameSchema.optional(),
	})
	.refine(
		(names) => LOCALES.some((locale) => names[locale] !== undefined),
		"tag_name_required",
	);

export type TagNames = z.infer<typeof tagNamesSchema>;

/** A tag of the same household, or null for a tag at the root. */
const parentIdSchema = z.uuid("tag_parent_invalid").nullable();

export const createTagSchema = z.strictObject({
	names: tagNamesSchema,
	/** Without it, the tag is at the root. */
	parentId: parentIdSchema.optional(),
});

export type CreateTag = z.infer<typeof createTagSchema>;

/**
 * Every field is optional: only the ones sent are changed. `names` replaces
 * every name of the tag; `parentId` moves it with its child tags.
 */
export const updateTagSchema = z.strictObject({
	names: tagNamesSchema.optional(),
	parentId: parentIdSchema.optional(),
});

export type UpdateTag = z.infer<typeof updateTagSchema>;

export const tagSchema = z.object({
	id: z.uuid(),
	householdId: z.uuid(),
	/** At least one language. */
	names: z.object({
		en: z.string().optional(),
		fr: z.string().optional(),
		es: z.string().optional(),
	}),
	/** Null for a tag at the root. */
	parentId: z.uuid().nullable(),
	createdAt: dateTimeSchema,
});

export type Tag = z.infer<typeof tagSchema>;

/**
 * A tag the product suggests to a household starting out, named in every
 * language, with the tags suggested under it.
 */
export interface SuggestedTag {
	/**
	 * Identifies the suggestion: the path leading to it ("transport/car/gas").
	 * It starts with the key of its parent.
	 */
	key: string;
	names: { en: string; fr: string; es: string };
	children: SuggestedTag[];
}

export const suggestedTagSchema: z.ZodType<SuggestedTag> = z.object({
	key: z.string(),
	names: z.object({ en: z.string(), fr: z.string(), es: z.string() }),
	// A getter: the schema refers to itself
	get children() {
		return z.array(suggestedTagSchema);
	},
});

/** The tree of suggested tags. */
export const suggestedTagsSchema = z.object({
	tags: z.array(suggestedTagSchema),
});

export type SuggestedTags = z.infer<typeof suggestedTagsSchema>;

/**
 * The suggestions a household keeps, by their keys. A suggestion comes with
 * the ones above it: a tag can't be added without its parent.
 */
export const addSuggestedTagsSchema = z.strictObject({
	keys: z
		.array(z.string("suggested_tags_invalid"), "suggested_tags_invalid")
		.min(1, "suggested_tags_required")
		.max(MAX_TAGS_PER_HOUSEHOLD, "suggested_tags_invalid"),
});

export type AddSuggestedTags = z.infer<typeof addSuggestedTagsSchema>;

/**
 * The name of a tag for a user: in their language, or else in the first
 * language that has one.
 */
export function tagDisplayName(names: Tag["names"], locale: Locale): string {
	const fallback = LOCALES.map((other) => names[other]).find(
		(name) => name !== undefined,
	);
	return names[locale] ?? fallback ?? "";
}
