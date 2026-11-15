import {
	type CreateDraft,
	RECEIPT_ITEM_NAME_MAX_LENGTH,
	RECEIPT_MAX_ITEMS,
	RECEIPT_MAX_TAXES,
	RECEIPT_PHOTO_MAX_BYTES,
	type Tag,
	TRANSACTION_NOTE_MAX_LENGTH,
	TRANSACTION_PAYEE_MAX_LENGTH,
	type TransactionDraft,
	tagNameSchema,
} from "@repo/schemas";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
	ledgerAccountHolders,
	ledgerAccounts,
	tagNames,
	tags,
	transactionLines,
	transactions,
} from "@/db/schema";
import {
	type AssistantDraft,
	type AssistantReceipt,
	assistant,
} from "@/lib/assistant";
import { AppError } from "@/lib/errors";
import type { Locale } from "@/lib/locale";
import { createRateLimiter } from "@/lib/rate-limit";
import type { Viewer } from "@/routes/accounts/accounts.service";
import {
	parseDraftAmount,
	parsePrintedAmount,
} from "@/routes/drafts/draft-amounts";
import {
	buildDraftContext,
	buildDraftEntry,
	type ContextPayee,
	type References,
} from "@/routes/drafts/draft-context";
import { shareTotal } from "@/routes/drafts/receipt-lines";
import { detectImageType } from "@/routes/drafts/receipt-photo";
import { findSimilarTags } from "@/routes/tags/similar-tags";

/** Notes a member may turn into drafts per hour: far above any real use. */
export const DRAFTS_PER_HOUR = 60;

export const draftLimiter = createRateLimiter({
	limit: DRAFTS_PER_HOUR,
	windowMs: 60 * 60 * 1000,
});

/** Receipts a member may scan per hour, counted apart from the notes. */
export const RECEIPTS_PER_HOUR = 30;

export const receiptLimiter = createRateLimiter({
	limit: RECEIPTS_PER_HOUR,
	windowMs: 60 * 60 * 1000,
});

/** Recent payees sent with each note, so the assistant learns the household's habits. */
const PAYEE_HISTORY = 50;

function tooMany(): AppError {
	return new AppError(
		429,
		"too_many_requests",
		"Too many in the last hour: enter by hand or try again later",
	);
}

function notUnderstood(): AppError {
	return new AppError(
		422,
		"draft_not_understood",
		"The assistant couldn't turn this note into a transaction",
	);
}

/** The household's accounts, each marked if the member may record on it. */
async function accountsFor({ userId, membership }: Viewer) {
	const householdId = membership.household.id;
	const [rows, held] = await Promise.all([
		db
			.select({
				id: ledgerAccounts.id,
				name: ledgerAccounts.name,
				visibility: ledgerAccounts.visibility,
				archivedAt: ledgerAccounts.archivedAt,
			})
			.from(ledgerAccounts)
			.where(eq(ledgerAccounts.householdId, householdId))
			.orderBy(ledgerAccounts.createdAt, ledgerAccounts.id),
		db
			.select({ accountId: ledgerAccountHolders.accountId })
			.from(ledgerAccountHolders)
			.where(
				and(
					eq(ledgerAccountHolders.householdId, householdId),
					eq(ledgerAccountHolders.userId, userId),
				),
			),
	]);
	const heldIds = new Set(held.map((row) => row.accountId));
	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		archived: row.archivedAt !== null,
		writable: heldIds.has(row.id) && row.archivedAt === null,
		seesDetails: heldIds.has(row.id) || row.visibility === "details",
	}));
}

async function tagsOf(householdId: string): Promise<Tag[]> {
	const [rows, names] = await Promise.all([
		db.select().from(tags).where(eq(tags.householdId, householdId)),
		db.select().from(tagNames).where(eq(tagNames.householdId, householdId)),
	]);
	return rows.map((row) => ({
		id: row.id,
		householdId: row.householdId,
		parentId: row.parentId,
		createdAt: row.createdAt.toISOString(),
		names: Object.fromEntries(
			names
				.filter((name) => name.tagId === row.id)
				.map((name) => [name.locale, name.name]),
		),
	}));
}

/**
 * The payees the household recently recorded with their tag, from the
 * accounts whose details the member may see: no habit of an account that
 * hides its transactions from them leaves through the assistant.
 */
async function recentPayees(
	householdId: string,
	visibleAccountIds: string[],
): Promise<ContextPayee[]> {
	if (visibleAccountIds.length === 0) {
		return [];
	}
	const rows = await db
		.select({ payee: transactions.payee, tagId: transactionLines.tagId })
		.from(transactions)
		.innerJoin(
			transactionLines,
			eq(transactionLines.transactionId, transactions.id),
		)
		.where(
			and(
				eq(transactions.householdId, householdId),
				inArray(transactions.accountId, visibleAccountIds),
				isNotNull(transactions.payee),
				isNotNull(transactionLines.tagId),
			),
		)
		.orderBy(desc(transactions.date), desc(transactions.createdAt))
		.limit(PAYEE_HISTORY * 4);
	const payees = new Map<string, ContextPayee>();
	for (const { payee, tagId } of rows) {
		const key = payee?.toLowerCase();
		// The most recent tag of each payee
		if (
			payee &&
			tagId &&
			key &&
			!payees.has(key) &&
			payees.size < PAYEE_HISTORY
		) {
			payees.set(key, { payee, tagId });
		}
	}
	return [...payees.values()];
}

/** A text trimmed and cut to `max`; null when empty. */
function text(value: string | null, max: number): string | null {
	const trimmed = value?.trim().slice(0, max).trim();
	return trimmed ? trimmed : null;
}

function isCalendarDay(value: string | null): value is string {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}
	const date = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** The proposed tag, checked: valid names, a known parent, its look-alikes. */
function proposeTag(
	proposal: AssistantDraft["new_tag"],
	references: References,
	householdTags: Tag[],
) {
	if (!proposal) {
		return undefined;
	}
	const names = {
		en: tagNameSchema.safeParse(proposal.name_en),
		fr: tagNameSchema.safeParse(proposal.name_fr),
		es: tagNameSchema.safeParse(proposal.name_es),
	};
	if (!names.en.success || !names.fr.success || !names.es.success) {
		return undefined;
	}
	const parentId =
		(proposal.parent && references.tags.get(proposal.parent)) || null;
	const proposed = { en: names.en.data, fr: names.fr.data, es: names.es.data };
	const similarTags = findSimilarTags(Object.values(proposed), householdTags);
	// The same name under the same parent: that tag already exists, use it
	const existing = similarTags.find(
		({ tagId, reason }) =>
			reason === "same_name" &&
			householdTags.find((tag) => tag.id === tagId)?.parentId === parentId,
	);
	return existing
		? { existingTagId: existing.tagId }
		: {
				tag: {
					names: proposed,
					parentId,
					similarTags: similarTags.slice(0, 5),
				},
			};
}

/** What the assistant answered, checked against the household and turned into a draft. */
export function toDraft(
	answer: AssistantDraft,
	{
		references,
		accounts,
		householdTags,
		currency,
		today,
	}: {
		references: References;
		accounts: Awaited<ReturnType<typeof accountsFor>>;
		householdTags: Tag[];
		currency: string;
		today: string;
	},
): TransactionDraft {
	const accountOf = (reference: string | null) =>
		accounts.find(
			(account) =>
				reference !== null && account.id === references.accounts.get(reference),
		);
	// Recorded on an account the member holds; a transfer goes to any other
	const account = accountOf(answer.account);
	const accountId = account?.writable ? account.id : null;
	const destination = accountOf(answer.to_account);
	const toAccountId =
		answer.type === "transfer" &&
		destination &&
		!destination.archived &&
		destination.id !== accountId
			? destination.id
			: null;

	const proposal = proposeTag(answer.new_tag, references, householdTags);
	let lines = answer.lines.flatMap(({ amount, tag }) => {
		const parsed = parseDraftAmount(amount, currency);
		if (parsed === null) {
			return [];
		}
		if (tag === "new" && proposal) {
			return [
				{
					amount: parsed,
					tagId: proposal.existingTagId ?? null,
					usesProposedTag: proposal.tag !== undefined,
				},
			];
		}
		const tagId = (tag && references.tags.get(tag)) || null;
		return [{ amount: parsed, tagId, usesProposedTag: false }];
	});
	if (answer.type === "transfer") {
		// One amount, no tag
		lines = lines
			.slice(0, 1)
			.map((line) => ({ ...line, tagId: null, usesProposedTag: false }));
	}
	if (lines.length === 0) {
		throw notUnderstood();
	}
	const usesProposedTag = lines.some((line) => line.usesProposedTag);

	return {
		type: answer.type,
		date: isCalendarDay(answer.date) ? answer.date : today,
		accountId,
		toAccountId,
		payee:
			answer.type === "transfer"
				? null
				: text(answer.payee, TRANSACTION_PAYEE_MAX_LENGTH),
		note: text(answer.note, TRANSACTION_NOTE_MAX_LENGTH),
		lines,
		proposedTag: usesProposedTag && proposal?.tag ? proposal.tag : null,
		remark: text(answer.remark, 300),
		receipt: null,
		warnings: [],
	};
}

/**
 * Turns a member's note into a draft transaction, to review: nothing is
 * saved, no tag is created.
 */
/** The household as the assistant sees it, for this member. */
async function contextFor(viewer: Viewer, locale: Locale) {
	const { household } = viewer.membership;
	const [accounts, householdTags] = await Promise.all([
		accountsFor(viewer),
		tagsOf(household.id),
	]);
	const payees = await recentPayees(
		household.id,
		accounts
			.filter((account) => account.seesDetails)
			.map((account) => account.id),
	);
	const { context, references } = buildDraftContext({
		currency: household.currency,
		locale,
		accounts: accounts
			.filter((account) => !account.archived)
			.map(({ id, name, writable }) => ({ id, name, writable })),
		tags: householdTags,
		payees,
	});
	return { context, references, accounts, householdTags };
}

/**
 * Turns a member's note into a draft transaction, to review: nothing is
 * saved, no tag is created.
 */
export async function draftTransaction(
	viewer: Viewer,
	{ text: note, today }: CreateDraft,
	locale: Locale,
): Promise<TransactionDraft> {
	if (!draftLimiter.consume(viewer.userId)) {
		throw tooMany();
	}
	const { household } = viewer.membership;
	const { context, references, accounts, householdTags } = await contextFor(
		viewer,
		locale,
	);
	const answer = await assistant.draftTransaction({
		context,
		entry: buildDraftEntry(note, today),
	});
	return toDraft(answer, {
		references,
		accounts,
		householdTags,
		currency: household.currency,
		today,
	});
}

/** The key of a receipt's group of items: a tag, the proposed tag, or none. */
const PROPOSED = "new";
const UNCATEGORIZED = "";

/**
 * What the assistant read on a receipt, checked against the household and
 * turned into a draft: its items grouped by tag, the taxes shared out among
 * them, and the receipt itself to keep with the transaction.
 */
export function toReceiptDraft(
	answer: AssistantReceipt,
	{
		references,
		accounts,
		householdTags,
		currency,
		today,
	}: {
		references: References;
		accounts: Awaited<ReturnType<typeof accountsFor>>;
		householdTags: Tag[];
		currency: string;
		today: string;
	},
): TransactionDraft {
	const total = parseDraftAmount(answer.total, currency);
	if (total === null) {
		throw notUnderstood();
	}
	const proposal = proposeTag(answer.new_tag, references, householdTags);
	const keyOf = (tag: string | null): string => {
		if (tag === PROPOSED) {
			if (proposal?.existingTagId) {
				return proposal.existingTagId;
			}
			return proposal?.tag ? PROPOSED : UNCATEGORIZED;
		}
		return (tag && references.tags.get(tag)) || UNCATEGORIZED;
	};

	const items = answer.items.flatMap(({ name, amount, tag }) => {
		const parsed = parsePrintedAmount(amount, currency);
		const label = text(name, RECEIPT_ITEM_NAME_MAX_LENGTH);
		return parsed === null || label === null
			? []
			: [{ name: label, amount: parsed, key: keyOf(tag) }];
	});
	const taxes = answer.taxes.flatMap(({ name, amount }) => {
		const parsed = parsePrintedAmount(amount, currency);
		const label = text(name, 40);
		return parsed === null || label === null
			? []
			: [{ name: label, amount: parsed }];
	});
	const subtotal =
		answer.subtotal === null
			? null
			: parsePrintedAmount(answer.subtotal, currency);

	const groups = new Map<string, number>();
	for (const { key, amount } of items) {
		groups.set(key, (groups.get(key) ?? 0) + amount);
	}
	const lines = shareTotal(
		total,
		[...groups].map(([key, amount]) => ({ key, amount })),
		UNCATEGORIZED,
	).map(({ key, amount }) => ({
		amount,
		tagId: key === UNCATEGORIZED || key === PROPOSED ? null : key,
		usesProposedTag: key === PROPOSED,
	}));

	// The lines follow the total, what was paid: say when the receipt's own
	// figures don't add up to it. Not the subtotal: some receipts leave
	// things out of it, such as a bottle deposit, and still add up.
	const itemsSum = items.reduce((sum, item) => sum + item.amount, 0);
	const taxesSum = taxes.reduce((sum, tax) => sum + tax.amount, 0);
	const mismatch = items.length > 0 && itemsSum + taxesSum !== total;

	const account = accounts.find(
		(candidate) =>
			answer.account !== null &&
			candidate.id === references.accounts.get(answer.account),
	);
	const merchant = text(answer.merchant, RECEIPT_ITEM_NAME_MAX_LENGTH);
	return {
		type: "expense",
		date: isCalendarDay(answer.date) ? answer.date : today,
		accountId: account?.writable ? account.id : null,
		toAccountId: null,
		payee: merchant
			? merchant.slice(0, TRANSACTION_PAYEE_MAX_LENGTH).trim()
			: null,
		note: text(answer.note, TRANSACTION_NOTE_MAX_LENGTH),
		lines,
		proposedTag:
			lines.some((line) => line.usesProposedTag) && proposal?.tag
				? proposal.tag
				: null,
		remark: text(answer.remark, 300),
		receipt: {
			merchant,
			items: items
				.slice(0, RECEIPT_MAX_ITEMS)
				.map(({ name, amount }) => ({ name, amount })),
			subtotal,
			taxes: taxes.slice(0, RECEIPT_MAX_TAXES),
			total,
		},
		warnings: mismatch ? ["receipt_total_mismatch"] : [],
	};
}

/**
 * Turns the photo of a receipt into a draft expense, to review. The photo
 * is read in memory, sent to the assistant and forgotten: never stored, never
 * logged.
 */
export async function draftFromReceipt(
	viewer: Viewer,
	{ photo, today }: { photo: File; today: string },
	locale: Locale,
): Promise<TransactionDraft> {
	if (photo.size > RECEIPT_PHOTO_MAX_BYTES) {
		throw new AppError(413, "payload_too_large", "The photo is too large");
	}
	const bytes = new Uint8Array(await photo.arrayBuffer());
	const mediaType = detectImageType(bytes);
	if (!mediaType) {
		throw new AppError(422, "validation_error", "Invalid request", [
			{ field: "photo", message: "receipt_photo_invalid" },
		]);
	}
	if (!receiptLimiter.consume(viewer.userId)) {
		throw tooMany();
	}
	const { household } = viewer.membership;
	const { context, references, accounts, householdTags } = await contextFor(
		viewer,
		locale,
	);
	const answer = await assistant.readReceipt({
		context,
		photo: { mediaType, data: Buffer.from(bytes).toString("base64") },
		today,
	});
	return toReceiptDraft(answer, {
		references,
		accounts,
		householdTags,
		currency: household.currency,
		today,
	});
}
