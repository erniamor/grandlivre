import {
	type CreateTag,
	LOCALES,
	type Locale,
	MAX_TAGS_PER_HOUSEHOLD,
	type Paginated,
	type SuggestedTag,
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
	isNull,
	ne,
	or,
	sql,
} from "drizzle-orm";
import { db, type Transaction } from "@/db/client";
import { households, tagNames, tags, transactionLines } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { offsetOf, type PaginationQuery } from "@/lib/pagination";
import { suggestedTags } from "@/routes/tags/suggested-tags";

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
 * Serializes the changes to a household's tags: the rule on names is checked
 * here, not by the database, so two changes must not run at the same time.
 */
async function lockTags(tx: Transaction, householdId: string): Promise<void> {
	await tx
		.select({ id: households.id })
		.from(households)
		.where(eq(households.id, householdId))
		.for("update");
}

/**
 * Under a same parent (or at the root), a name designates a single tag in a
 * given language, whatever its case: refuses the names a sibling already
 * has. The same name can exist under another parent ("Car › Insurance",
 * "Home › Insurance"). Call `lockTags()` first.
 */
async function assertNamesFree(
	tx: Transaction,
	householdId: string,
	parentId: string | null,
	names: TagNames,
	exceptTagId?: string,
): Promise<void> {
	const sameName = entriesOf(names).map(([locale, name]) =>
		and(
			eq(tagNames.locale, locale),
			// The index is on lower(name) too
			eq(sql`lower(${tagNames.name})`, name.toLowerCase()),
		),
	);
	const taken = await tx
		.select({ locale: tagNames.locale })
		.from(tagNames)
		.innerJoin(tags, eq(tags.id, tagNames.tagId))
		.where(
			and(
				eq(tagNames.householdId, householdId),
				parentId === null ? isNull(tags.parentId) : eq(tags.parentId, parentId),
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
		await lockTags(tx, householdId);
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
		await assertNamesFree(tx, householdId, parentId, names);
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
		// Also keeps two concurrent moves from building a loop together
		await lockTags(tx, householdId);
		let [row] = await tx
			.select()
			.from(tags)
			.where(inHousehold(householdId, tagId));
		if (!row) {
			throw notFound();
		}
		const current = (await namesOf([tagId], tx)).get(tagId) ?? {};
		const moves = parentId !== undefined && parentId !== row.parentId;
		const nextParentId = moves ? parentId : row.parentId;
		if (moves && parentId !== null) {
			await assertCanMoveUnder(tx, householdId, tagId, parentId);
		}
		// New names, a new parent, or both: its future siblings must not have them
		if (names || moves) {
			await assertNamesFree(
				tx,
				householdId,
				nextParentId,
				names ?? current,
				tagId,
			);
		}
		if (moves) {
			const [moved] = await tx
				.update(tags)
				.set({ parentId: nextParentId })
				.where(eq(tags.id, tagId))
				.returning();
			row = moved ?? row;
		}
		if (names) {
			await tx.delete(tagNames).where(eq(tagNames.tagId, tagId));
			await insertNames(tx, householdId, tagId, names);
		}
		return toTag(row, names ? Object.fromEntries(entriesOf(names)) : current);
	});
}

/**
 * A tag that has child tags or transactions can't be deleted: they would
 * lose their place or their category.
 */
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
		// Its transactions would lose their category
		const [line] = await tx
			.select({ id: transactionLines.id })
			.from(transactionLines)
			.where(eq(transactionLines.tagId, tagId))
			.limit(1);
		if (line) {
			throw new AppError(
				409,
				"tag_in_use",
				"A tag that has transactions can't be deleted",
			);
		}
		await tx.delete(tags).where(eq(tags.id, tagId));
	});
}

/** Every key of the suggested tree. */
function keysOf(suggestions: SuggestedTag[]): string[] {
	return suggestions.flatMap(({ key, children }) => [key, ...keysOf(children)]);
}

/**
 * The keys chosen, with those of the suggestions above them: a tag can't be
 * added without its parent. A key starts with its parent's ("car/gas").
 */
function withAncestors(keys: string[]): Set<string> {
	const selected = new Set<string>();
	for (const key of keys) {
		const parts = key.split("/");
		for (let depth = 1; depth <= parts.length; depth += 1) {
			selected.add(parts.slice(0, depth).join("/"));
		}
	}
	return selected;
}

/**
 * Adds the suggested tags chosen that the household doesn't have yet. A
 * suggestion whose name a tag already has at the same place, in any
 * language, isn't added again; its children go under the existing tag.
 */
export async function addSuggestedTags(
	householdId: string,
	keys: string[],
): Promise<void> {
	const known = new Set(keysOf(suggestedTags));
	if (keys.some((key) => !known.has(key))) {
		throw invalid("keys", "suggested_tags_invalid");
	}
	const selected = withAncestors(keys);

	await db.transaction(async (tx) => {
		await lockTags(tx, householdId);
		const existing = await tx
			.select({
				tagId: tagNames.tagId,
				locale: tagNames.locale,
				name: tagNames.name,
				parentId: tags.parentId,
			})
			.from(tagNames)
			.innerJoin(tags, eq(tags.id, tagNames.tagId))
			.where(eq(tagNames.householdId, householdId));
		// A name designates a tag among the children of a same parent
		const keyOf = (parentId: string | null, locale: Locale, name: string) =>
			`${parentId ?? "root"}:${locale}:${name.toLowerCase()}`;
		const tagByName = new Map(
			existing.map((row) => [
				keyOf(row.parentId, row.locale, row.name),
				row.tagId,
			]),
		);

		const add = async (
			suggestions: SuggestedTag[],
			parentId: string | null,
		) => {
			for (const { key, names, children } of suggestions) {
				// Not chosen: neither is anything under it
				if (!selected.has(key)) {
					continue;
				}
				const nameKeys = entriesOf(names).map(([locale, name]) =>
					keyOf(parentId, locale, name),
				);
				let tagId = nameKeys
					.map((nameKey) => tagByName.get(nameKey))
					.find((id) => id !== undefined);
				if (tagId === undefined) {
					await assertUnderLimit(tx, householdId);
					tagId = (await insertTag(tx, householdId, names, parentId)).id;
					for (const nameKey of nameKeys) {
						tagByName.set(nameKey, tagId);
					}
				}
				await add(children, tagId);
			}
		};
		await add(suggestedTags, null);
	});
}
