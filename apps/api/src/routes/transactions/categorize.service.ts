import type {
	CategorizePayee,
	CategorizeResult,
	Paginated,
	UncategorizedPayee,
} from "@repo/schemas";
import { and, eq, exists, inArray, isNotNull, not, sql } from "drizzle-orm";
import { db, type Transaction as Tx } from "@/db/client";
import { tags, transactionLines, transactions } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { publishHouseholdEvent } from "@/lib/events";
import type { PaginationQuery } from "@/lib/pagination";
import type { Viewer } from "@/routes/accounts/accounts.service";
import { descriptionKey } from "@/routes/imports/statements/fingerprint";
import { accountAccess } from "@/routes/transactions/transactions.service";

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
 * account they hold, still open, none of their lines tagged.
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

/**
 * The expenses and incomes without a tag of the member's accounts, by
 * payee: payees alike in their letters together, the expenses and the
 * incomes apart; the payees with the most transactions first. Those
 * without a payee are left out: nothing groups them.
 */
export async function listUncategorizedPayees(
	viewer: Viewer,
	pagination: PaginationQuery,
): Promise<Paginated<UncategorizedPayee>> {
	const groups = new Map<
		string,
		UncategorizedPayee & { spellings: Map<string, number> }
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
			spellings: new Map<string, number>(),
		};
		group.count += 1;
		group.total += row.amount;
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
	const sorted = [...groups.values()]
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
	const start = (pagination.page - 1) * pagination.pageSize;
	return {
		data: sorted.slice(start, start + pagination.pageSize),
		pagination: { ...pagination, total: sorted.length },
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
