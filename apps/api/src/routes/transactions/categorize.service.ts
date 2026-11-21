import type {
	CategorizePayee,
	CategorizeResult,
	Paginated,
	PayeeTagSuggestions,
	SetAsideUndetermined,
	SuggestPayeeTags,
	UncategorizedCount,
	UncategorizedPayee,
} from "@repo/schemas";
import {
	and,
	eq,
	exists,
	inArray,
	isNotNull,
	isNull,
	not,
	sql,
} from "drizzle-orm";
import { db, type Transaction as Tx } from "@/db/client";
import { tags, transactionLines, transactions } from "@/db/schema";
import { assistant } from "@/lib/assistant";
import { AppError } from "@/lib/errors";
import { publishHouseholdEvent } from "@/lib/events";
import type { Locale } from "@/lib/locale";
import type { PaginationQuery } from "@/lib/pagination";
import { createRateLimiter } from "@/lib/rate-limit";
import type { Viewer } from "@/routes/accounts/accounts.service";
import { formatDraftAmount } from "@/routes/drafts/draft-amounts";
import { describeTags } from "@/routes/drafts/draft-context";
import { recentPayees, tagsOf } from "@/routes/drafts/drafts.service";
import { descriptionKey } from "@/routes/imports/statements/fingerprint";
import { accountAccess } from "@/routes/transactions/transactions.service";

/** Times a member may ask for tag suggestions per hour: far above any real use. */
export const TAG_SUGGESTIONS_PER_HOUR = 30;

export const tagSuggestionLimiter = createRateLimiter({
	limit: TAG_SUGGESTIONS_PER_HOUR,
	windowMs: 60 * 60 * 1000,
});

/** An expense or an income without a tag, on an account the member holds. */
interface Uncategorized {
	id: string;
	type: "expense" | "income";
	payee: string | null;
	amount: number;
	date: string;
}

/**
 * The expenses and incomes without a tag the member may categorize: on an
 * account they hold, still open, none of their lines tagged, not set aside
 * as undetermined.
 */
async function uncategorized(
	database: typeof db | Tx,
	viewer: Viewer,
): Promise<Uncategorized[]> {
	const access = await accountAccess(database, viewer);
	const held = [...access]
		.filter(([, rights]) => rights.isHolder && !rights.archived)
		.map(([accountId]) => accountId);
	if (held.length === 0) {
		return [];
	}
	const rows = await database
		.select({
			id: transactions.id,
			type: transactions.type,
			payee: transactions.payee,
			amount: transactions.amount,
			date: transactions.date,
		})
		.from(transactions)
		.where(
			and(
				eq(transactions.householdId, viewer.membership.household.id),
				inArray(transactions.accountId, held),
				inArray(transactions.type, ["expense", "income"]),
				isNull(transactions.undeterminedAt),
				not(
					exists(
						database
							.select({ one: sql`1` })
							.from(transactionLines)
							.where(
								and(
									eq(transactionLines.transactionId, transactions.id),
									isNotNull(transactionLines.tagId),
								),
							),
					),
				),
			),
		);
	return rows.flatMap((row) =>
		row.type === "transfer" ? [] : [{ ...row, type: row.type }],
	);
}

/** How many expenses and incomes the member may categorize are left without a tag. */
export async function countUncategorized(viewer: Viewer): Promise<number> {
	return (await uncategorized(db, viewer)).length;
}

/** A payee's transactions without a tag, with their amounts. */
type PayeeGroup = UncategorizedPayee & { amounts: number[] };

/**
 * The expenses and incomes without a tag of the member's accounts, by
 * payee: payees alike in their letters together, the expenses and the
 * incomes apart; the payees with the most transactions first. Those
 * without a payee are left out: nothing groups them.
 */
async function payeeGroups(viewer: Viewer): Promise<PayeeGroup[]> {
	const groups = new Map<
		string,
		PayeeGroup & { spellings: Map<string, number> }
	>();
	for (const row of await uncategorized(db, viewer)) {
		const key = descriptionKey(row.payee ?? "");
		if (key === "" || !row.payee) {
			continue;
		}
		const id = `${row.type}:${key}`;
		const group = groups.get(id) ?? {
			key,
			payee: row.payee,
			type: row.type,
			count: 0,
			total: 0,
			firstDate: row.date,
			lastDate: row.date,
			amounts: [],
			spellings: new Map<string, number>(),
		};
		group.count += 1;
		group.total += row.amount;
		group.amounts.push(row.amount);
		// Days as YYYY-MM-DD: their text sorts as the days do
		if (row.date < group.firstDate) {
			group.firstDate = row.date;
		}
		if (row.date > group.lastDate) {
			group.lastDate = row.date;
		}
		group.spellings.set(row.payee, (group.spellings.get(row.payee) ?? 0) + 1);
		groups.set(id, group);
	}
	return [...groups.values()]
		.map(({ spellings, ...group }) => ({
			...group,
			// As most of its transactions write it
			payee:
				[...spellings].sort(
					(a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
				)[0]?.[0] ?? group.payee,
		}))
		.sort(
			(a, b) =>
				b.count - a.count ||
				b.total - a.total ||
				a.payee.localeCompare(b.payee),
		);
}

/** The payees of the member's expenses and incomes without a tag, a page of them. */
export async function listUncategorizedPayees(
	viewer: Viewer,
	pagination: PaginationQuery,
): Promise<Paginated<UncategorizedPayee>> {
	const sorted = await payeeGroups(viewer);
	const start = (pagination.page - 1) * pagination.pageSize;
	return {
		data: sorted
			.slice(start, start + pagination.pageSize)
			.map(({ amounts: _amounts, ...group }) => group),
		pagination: { ...pagination, total: sorted.length },
	};
}

/** The middle amount, the usual one. */
function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * The assistant's tag for each payee asked, among the member's payees
 * without a tag: one of the household's tags, or null. Nothing is applied:
 * the member reviews each one. The assistant gets the payees as their
 * transactions write them, the household's tags and the payees already
 * tagged, of the accounts whose details the member may see.
 */
export async function suggestPayeeTags(
	viewer: Viewer,
	{ payees }: SuggestPayeeTags,
	locale: Locale,
): Promise<PayeeTagSuggestions> {
	if (!tagSuggestionLimiter.consume(viewer.userId)) {
		throw new AppError(
			429,
			"too_many_requests",
			"Too many in the last hour: choose the tags by hand or try again later",
		);
	}
	const { household } = viewer.membership;
	const asked = new Set(payees.map(({ key, type }) => `${type}:${key}`));
	const groups = (await payeeGroups(viewer)).filter((group) =>
		asked.has(`${group.type}:${group.key}`),
	);
	if (groups.length === 0) {
		return { suggestions: [] };
	}
	const [householdTags, access] = await Promise.all([
		tagsOf(household.id),
		accountAccess(db, viewer),
	]);
	const habits = await recentPayees(
		household.id,
		[...access]
			.filter(([, rights]) => rights.seesDetails)
			.map(([accountId]) => accountId),
	);
	const described = describeTags(householdTags, locale, habits);
	const context = [
		`Household currency: ${household.currency}`,
		`Member's language: ${locale}`,
		"",
		"Tags:",
		...(described.tagLines.length > 0 ? described.tagLines : ["(none yet)"]),
		"",
		"Payees already tagged, with their usual tag:",
		...(described.payeeLines.length > 0
			? described.payeeLines
			: ["(none yet)"]),
	].join("\n");
	const lines = groups.map(
		(group, index) =>
			`p${index + 1} | ${group.type} | ${group.payee} | ${group.count} ${group.count === 1 ? "time" : "times"} | usually ${formatDraftAmount(median(group.amounts), household.currency)}`,
	);
	const answer = await assistant.suggestTags({
		context,
		payees: lines.join("\n"),
	});
	// What the assistant answers is checked: known payees and tags only
	const tagOf = new Map(
		answer.suggestions.map(({ payee, tag }) => [
			payee,
			tag === null ? null : (described.tags.get(tag) ?? null),
		]),
	);
	return {
		suggestions: groups.map((group, index) => ({
			key: group.key,
			type: group.type,
			tagId: tagOf.get(`p${index + 1}`) ?? null,
		})),
	};
}

/**
 * Tags every expense (or income) without a tag of a payee, on the member's
 * accounts: their lines, all of them. The next imports learn it from them.
 */
export async function categorizePayee(
	viewer: Viewer,
	{ key, type, tagId }: CategorizePayee,
): Promise<CategorizeResult> {
	const householdId = viewer.membership.household.id;
	return db.transaction(async (tx) => {
		const [tag] = await tx
			.select({ id: tags.id })
			.from(tags)
			.where(and(eq(tags.id, tagId), eq(tags.householdId, householdId)));
		if (!tag) {
			throw new AppError(422, "validation_error", "Invalid request", [
				{ field: "tagId", message: "transaction_tag_invalid" },
			]);
		}
		const ids = (await uncategorized(tx, viewer))
			.filter(
				(row) => row.type === type && descriptionKey(row.payee ?? "") === key,
			)
			.map((row) => row.id);
		if (ids.length > 0) {
			await tx
				.update(transactionLines)
				.set({ tagId })
				.where(inArray(transactionLines.transactionId, ids));
			await publishHouseholdEvent(tx, householdId, "transactions");
		}
		return { count: ids.length };
	});
}

/**
 * How many expenses and incomes the member may categorize are left without
 * a tag before a day, excluded: what setting them aside would take.
 */
export async function countUncategorizedBefore(
	viewer: Viewer,
	before: string,
): Promise<UncategorizedCount> {
	// Days as YYYY-MM-DD: their text sorts as the days do
	const rows = await uncategorized(db, viewer);
	return { count: rows.filter((row) => row.date < before).length };
}

/**
 * Sets aside as undetermined the expenses (or incomes) without a tag of a
 * payee, or all those before a day, on the member's accounts. Not a tag:
 * nothing learns from them, and the payee's next ones are to categorize.
 */
export async function setAsideUndetermined(
	viewer: Viewer,
	input: SetAsideUndetermined,
): Promise<CategorizeResult> {
	const householdId = viewer.membership.household.id;
	return db.transaction(async (tx) => {
		const ids = (await uncategorized(tx, viewer))
			.filter((row) =>
				input.by === "payee"
					? row.type === input.type &&
						descriptionKey(row.payee ?? "") === input.key
					: row.date < input.date,
			)
			.map((row) => row.id);
		if (ids.length > 0) {
			await tx
				.update(transactions)
				.set({ undeterminedAt: new Date() })
				.where(inArray(transactions.id, ids));
			await publishHouseholdEvent(tx, householdId, "transactions");
		}
		return { count: ids.length };
	});
}
