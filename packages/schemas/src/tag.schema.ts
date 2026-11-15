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
 * The name of a tag for a user: in their language, or else in the first
 * language that has one.
 */
export function tagDisplayName(names: Tag["names"], locale: Locale): string {
	const fallback = LOCALES.map((other) => names[other]).find(
		(name) => name !== undefined,
	);
	return names[locale] ?? fallback ?? "";
}
