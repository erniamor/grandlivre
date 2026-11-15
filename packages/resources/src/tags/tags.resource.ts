import {
	type AddSuggestedTags,
	addSuggestedTagsSchema,
	type CreateTag,
	createTagSchema,
	MAX_TAGS_PER_HOUSEHOLD,
	paginatedSchema,
	type SuggestedTag,
	suggestedTagsSchema,
	type Tag,
	tagSchema,
	type UpdateTag,
	updateTagSchema,
} from "@repo/schemas";
import { segment, withQuery } from "../api/page";
import { type ApiClient, parseInput } from "../http/client";

const tagsPageSchema = paginatedSchema(tagSchema);

const tagsPath = (householdId: string) =>
	`/households/${segment(householdId)}/tags`;

/**
 * The tags of a household: the categories of its transactions, as a tree,
 * named in each language. Shared and managed by all its members. A household
 * the user isn't a member of, or an unknown tag, rejects with a NotFoundError.
 */
export function createTagsResource(client: ApiClient) {
	return {
		/**
		 * Every tag of the household, oldest first: a household's tags fit in
		 * one page. Their tree is built from `parentId`.
		 */
		async list(
			householdId: string,
			options: { signal?: AbortSignal } = {},
		): Promise<Tag[]> {
			const page = await client.request({
				path: withQuery(tagsPath(householdId), {
					pageSize: MAX_TAGS_PER_HOUSEHOLD,
				}),
				response: tagsPageSchema,
				signal: options.signal,
			});
			return page.data;
		},

		/**
		 * A name another tag under the same parent already has in the same
		 * language rejects with a ValidationError on `names.<locale>`
		 * (`tag_name_taken`). The same name can exist under different parents.
		 */
		async create(householdId: string, input: CreateTag): Promise<Tag> {
			return client.request({
				method: "POST",
				path: tagsPath(householdId),
				body: parseInput(createTagSchema, input),
				response: tagSchema,
			});
		},

		/**
		 * The tags the product suggests to a household starting out: a tree,
		 * each tag named in every language and identified by its `key`.
		 */
		async suggested(
			householdId: string,
			options: { signal?: AbortSignal } = {},
		): Promise<SuggestedTag[]> {
			const { tags } = await client.request({
				path: `${tagsPath(householdId)}/suggested`,
				response: suggestedTagsSchema,
				signal: options.signal,
			});
			return tags;
		},

		/**
		 * Adds the suggestions chosen, by their keys, that the household
		 * doesn't have yet. A suggestion comes with the ones above it.
		 */
		async addSuggested(
			householdId: string,
			input: AddSuggestedTags,
		): Promise<void> {
			await client.request({
				method: "POST",
				path: `${tagsPath(householdId)}/suggested`,
				body: parseInput(addSuggestedTagsSchema, input),
			});
		},

		/**
		 * Changes the fields given: `names` replaces every name of the tag,
		 * `parentId` moves it with its child tags (`null`: to the root). Rejects
		 * like `create()` when a tag it would sit next to has one of its names.
		 */
		async update(
			householdId: string,
			tagId: string,
			input: UpdateTag,
		): Promise<Tag> {
			return client.request({
				method: "PATCH",
				path: `${tagsPath(householdId)}/${segment(tagId)}`,
				body: parseInput(updateTagSchema, input),
				response: tagSchema,
			});
		},

		/** Rejects with an ApiError `tag_has_children` (409) for a tag that has child tags. */
		async remove(householdId: string, tagId: string): Promise<void> {
			await client.request({
				method: "DELETE",
				path: `${tagsPath(householdId)}/${segment(tagId)}`,
			});
		},
	};
}

export type TagsResource = ReturnType<typeof createTagsResource>;
