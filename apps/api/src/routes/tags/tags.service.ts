import {
	type CreateTag,
	LOCALES,
	type Locale,
	MAX_TAGS_PER_HOUSEHOLD,
	type Paginated,
	type Tag,
	type TagNames,
	type UpdateTag,
} from "@repo/schemas";
import {
	and,
	asc,
	count,
	eq,
	type InferSelectModel,
	inArray,
	ne,
	or,
	sql,
} from "drizzle-orm";
import { db, type Transaction } from "@/db/client";
import { tagNames, tags } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { offsetOf, type PaginationQuery } from "@/lib/pagination";
import { type SuggestedTag, suggestedTags } from "@/routes/tags/suggested-tags";

type TagRow = InferSelectModel<typeof tags>;

function notFound(): AppError {
	return new AppError(404, "not_found", "Tag not found");
}

function invalid(field: string, message: string): AppError {
	return new AppError(422, "validation_error", "Invalid request", [
		{ field, message },
	]);
}

function toTag(row: TagRow, names: Tag["names"]): Tag {
	return {
		id: row.id,
		householdId: row.householdId,
		names,
		parentId: row.parentId,
		createdAt: row.createdAt.toISOString(),
	};
}

/** The languages of `names` that have a name, with it. */
function entriesOf(names: TagNames): [Locale, string][] {
	return LOCALES.flatMap((locale) => {
		const name = names[locale];
		return name === undefined ? [] : [[locale, name] as [Locale, string]];
	});
}

/** The names of each of the tags, by language. */
async function namesOf(
	tagIds: string[],
	database: typeof db | Transaction = db,
): Promise<Map<string, Tag["names"]>> {
	const byTag = new Map<string, Tag["names"]>();
	if (tagIds.length === 0) {
		return byTag;
	}
	const rows = await database
		.select()
		.from(tagNames)
		.where(inArray(tagNames.tagId, tagIds));
	for (const row of rows) {
		byTag.set(row.tagId, { ...byTag.get(row.tagId), [row.locale]: row.name });
	}
	return byTag;
}

const inHousehold = (householdId: string, tagId: string) =>
	and(eq(tags.id, tagId), eq(tags.householdId, householdId));

/**
 * In a household, a name designates a single tag in a given language,
 * whatever its case: refuses the names another tag already has.
 */
async function assertNamesFree(
	tx: Transaction,
	householdId: string,
	names: TagNames,
	exceptTagId?: string,
): Promise<void> {
	const sameName = entriesOf(names).map(([locale, name]) =>
		and(
			eq(tagNames.locale, locale),
			// The unique index is on lower(name) too
			eq(sql`lower(${tagNames.name})`, name.toLowerCase()),
		),
	);
	const taken = await tx
		.select({ locale: tagNames.locale })
		.from(tagNames)
		.where(
			and(
				eq(tagNames.householdId, householdId),
				exceptTagId ? ne(tagNames.tagId, exceptTagId) : undefined,
				or(...sameName),
			),
		);
	if (taken.length > 0) {
		throw new AppError(
			422,
			"validation_error",
			"Invalid request",
			taken.map(({ locale }) => ({
				field: `names.${locale}`,
				message: "tag_name_taken",
			})),
		);
	}
}

async function insertNames(
	tx: Transaction,
	householdId: string,
	tagId: string,
	names: TagNames,
): Promise<void> {
	await tx.insert(tagNames).values(
		entriesOf(names).map(([locale, name]) => ({
			tagId,
			householdId,
			locale,
			name,
		})),
	);
}

async function assertUnderLimit(
	tx: Transaction,
	householdId: string,
	adding = 1,
): Promise<void> {
	const [counted] = await tx
		.select({ total: count() })
		.from(tags)
		.where(eq(tags.householdId, householdId));
	if ((counted?.total ?? 0) + adding > MAX_TAGS_PER_HOUSEHOLD) {
		throw new AppError(
			409,
			"tag_limit_reached",
			"The household has reached its maximum number of tags",
		);
	}
}

/** The tags of the household, oldest first; their tree is built from `parentId`. */
export async function listTags(
	householdId: string,
	pagination: PaginationQuery,
): Promise<Paginated<Tag>> {
	const ofHousehold = eq(tags.householdId, householdId);
	const [rows, [counted]] = await Promise.all([
		db
			.select()
			.from(tags)
			.where(ofHousehold)
			.orderBy(asc(tags.createdAt), asc(tags.id))
			.limit(pagination.pageSize)
			.offset(offsetOf(pagination)),
		db.select({ total: count() }).from(tags).where(ofHousehold),
	]);
	const names = await namesOf(rows.map((row) => row.id));
	return {
		data: rows.map((row) => toTag(row, names.get(row.id) ?? {})),
		pagination: { ...pagination, total: counted?.total ?? 0 },
	};
}

async function insertTag(
	tx: Transaction,
	householdId: string,
	names: TagNames,
	parentId: string | null,
): Promise<TagRow> {
	const [row] = await tx
		.insert(tags)
		.values({ householdId, parentId })
		.returning();
	if (!row) {
		throw new Error("The tag was not created");
	}
	await insertNames(tx, householdId, row.id, names);
	return row;
}

export async function createTag(
	householdId: string,
	{ names, parentId = null }: CreateTag,
): Promise<Tag> {
	return db.transaction(async (tx) => {
		await assertUnderLimit(tx, householdId);
		if (parentId !== null) {
			const [parent] = await tx
				.select({ id: tags.id })
				.from(tags)
				.where(inHousehold(householdId, parentId));
			if (!parent) {
				throw invalid("parentId", "tag_parent_invalid");
			}
		}
		await assertNamesFree(tx, householdId, names);
		const row = await insertTag(tx, householdId, names, parentId);
		return toTag(row, Object.fromEntries(entriesOf(names)));
	});
}

/**
 * A tag can't move under itself or under one of its descendants: the tree
 * would become a loop. Also refuses a parent from outside the household.
 */
async function assertCanMoveUnder(
	tx: Transaction,
	householdId: string,
	tagId: string,
	parentId: string,
): Promise<void> {
	const rows = await tx
		.select({ id: tags.id, parentId: tags.parentId })
		.from(tags)
		.where(eq(tags.householdId, householdId));
	const parentOf = new Map(rows.map((row) => [row.id, row.parentId]));
	if (!parentOf.has(parentId)) {
		throw invalid("parentId", "tag_parent_invalid");
	}
	// Walks up from the new parent: meeting the tag means it is a descendant
	let ancestor: string | null = parentId;
	while (ancestor !== null) {
		if (ancestor === tagId) {
			throw invalid("parentId", "tag_parent_invalid");
		}
		ancestor = parentOf.get(ancestor) ?? null;
	}
}

export async function updateTag(
	householdId: string,
	tagId: string,
	{ names, parentId }: UpdateTag,
): Promise<Tag> {
	return db.transaction(async (tx) => {
		// Locks the tag: two concurrent moves can't build a loop together
		let [row] = await tx
			.select()
			.from(tags)
			.where(inHousehold(householdId, tagId))
			.for("update");
		if (!row) {
			throw notFound();
		}
		if (parentId !== undefined && parentId !== row.parentId) {
			if (parentId !== null) {
				await assertCanMoveUnder(tx, householdId, tagId, parentId);
			}
			const [moved] = await tx
				.update(tags)
				.set({ parentId })
				.where(eq(tags.id, tagId))
				.returning();
			row = moved ?? row;
		}
		if (names) {
			await assertNamesFree(tx, householdId, names, tagId);
			await tx.delete(tagNames).where(eq(tagNames.tagId, tagId));
			await insertNames(tx, householdId, tagId, names);
		}
		const current = await namesOf([tagId], tx);
		return toTag(row, current.get(tagId) ?? {});
	});
}

/** A tag that has child tags can't be deleted: they would lose their place. */
export async function deleteTag(
	householdId: string,
	tagId: string,
): Promise<void> {
	await db.transaction(async (tx) => {
		const [row] = await tx
			.select({ id: tags.id })
			.from(tags)
			.where(inHousehold(householdId, tagId))
			.for("update");
		if (!row) {
			throw notFound();
		}
		const [child] = await tx
			.select({ id: tags.id })
			.from(tags)
			.where(eq(tags.parentId, tagId))
			.limit(1);
		if (child) {
			throw new AppError(
				409,
				"tag_has_children",
				"A tag that has child tags can't be deleted",
			);
		}
		await tx.delete(tags).where(eq(tags.id, tagId));
	});
}

/**
 * Adds the suggested tags the household doesn't have yet. A suggestion
 * whose name already exists, in any language, is left out; its children go
 * under the existing tag.
 */
export async function addSuggestedTags(householdId: string): Promise<void> {
	await db.transaction(async (tx) => {
		const existing = await tx
			.select()
			.from(tagNames)
			.where(eq(tagNames.householdId, householdId));
		const tagByName = new Map(
			existing.map((row) => [
				`${row.locale}:${row.name.toLowerCase()}`,
				row.tagId,
			]),
		);

		const add = async (
			suggestions: SuggestedTag[],
			parentId: string | null,
		) => {
			for (const { names, children = [] } of suggestions) {
				const keys = entriesOf(names).map(
					([locale, name]) => `${locale}:${name.toLowerCase()}`,
				);
				let tagId = keys
					.map((key) => tagByName.get(key))
					.find((id) => id !== undefined);
				if (tagId === undefined) {
					await assertUnderLimit(tx, householdId);
					tagId = (await insertTag(tx, householdId, names, parentId)).id;
					for (const key of keys) {
						tagByName.set(key, tagId);
					}
				}
				await add(children, tagId);
			}
		};
		await add(suggestedTags, null);
	});
}
