import type { HouseholdEventTopic } from "@repo/schemas";
import {
	and,
	asc,
	eq,
	type InferSelectModel,
	inArray,
	isNotNull,
	lte,
} from "drizzle-orm";
import { db, type Transaction as Tx } from "@/db/client";
import {
	households,
	ledgerAccountHolders,
	ledgerAccounts,
	recurringOccurrences,
	recurringTransactionLines,
	recurringTransactions,
	transactions,
} from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { publishHouseholdEvent } from "@/lib/events";
import { addDays, nextOccurrence } from "@/routes/recurring/schedule";
import { shareRecorded } from "@/routes/sharing/transaction-sharing";
import { insertLines } from "@/routes/transactions/transactions.service";

type RecurringRow = InferSelectModel<typeof recurringTransactions>;
type LineRow = InferSelectModel<typeof recurringTransactionLines>;

/** What a run did, across households. */
export interface RunSummary {
	recorded: number;
	pending: number;
}

/**
 * Whether the recurring transaction can be recorded without anyone: its
 * accounts take new transactions, and its account still has a holder to
 * answer for it.
 */
async function canRecordAlone(tx: Tx, rule: RecurringRow): Promise<boolean> {
	const accountIds = [rule.accountId, rule.toAccountId].flatMap((id) =>
		id ? [id] : [],
	);
	const [archived, [holder]] = await Promise.all([
		tx
			.select({ id: ledgerAccounts.id })
			.from(ledgerAccounts)
			.where(
				and(
					inArray(ledgerAccounts.id, accountIds),
					isNotNull(ledgerAccounts.archivedAt),
				),
			),
		tx
			.select({ userId: ledgerAccountHolders.userId })
			.from(ledgerAccountHolders)
			.where(eq(ledgerAccountHolders.accountId, rule.accountId))
			.limit(1),
	]);
	return archived.length === 0 && holder !== undefined;
}

/** Records the transaction of a recurring transaction on one of its days. */
async function recordOccurrence(
	tx: Tx,
	rule: RecurringRow,
	lines: LineRow[],
	date: string,
	expenseSharing: boolean,
): Promise<string> {
	const [row] = await tx
		.insert(transactions)
		.values({
			householdId: rule.householdId,
			type: rule.type,
			date,
			accountId: rule.accountId,
			toAccountId: rule.toAccountId,
			amount: rule.amount,
			payee: rule.payee,
			note: rule.note,
			origin: "recurring",
			// Recorded on behalf of whoever created the recurring transaction
			createdBy: rule.createdBy,
		})
		.returning({ id: transactions.id });
	if (!row) {
		throw new Error("The transaction was not created");
	}
	await insertLines(
		tx,
		rule.householdId,
		row.id,
		lines.map((line) => ({ amount: line.amount, tagId: line.tagId })),
	);
	if (rule.shareSplit) {
		await shareRecorded(
			tx,
			{ id: rule.householdId, expenseSharing },
			{ id: row.id, accountId: rule.accountId, amount: rule.amount },
			rule.shareSplit,
		);
	}
	return row.id;
}

/**
 * Handles the days of one recurring transaction that have come, up to
 * `today` in its household: each is recorded, or set aside for a member to
 * confirm, then its next day is moved on. A recurring transaction another
 * run holds is left to it.
 */
export async function runRecurring(
	recurringId: string,
	today: string,
): Promise<RunSummary> {
	return db.transaction(async (tx) => {
		const [rule] = await tx
			.select()
			.from(recurringTransactions)
			.where(
				and(
					eq(recurringTransactions.id, recurringId),
					lte(recurringTransactions.nextDate, today),
				),
			)
			.for("update", { skipLocked: true });
		if (!rule?.nextDate) {
			return { recorded: 0, pending: 0 };
		}
		const lines = await tx
			.select()
			.from(recurringTransactionLines)
			.where(eq(recurringTransactionLines.recurringId, rule.id))
			.orderBy(asc(recurringTransactionLines.position));
		const alone = rule.mode === "automatic" && (await canRecordAlone(tx, rule));
		const [household] = await tx
			.select({ expenseSharing: households.expenseSharing })
			.from(households)
			.where(eq(households.id, rule.householdId));
		const schedule = {
			unit: rule.unit,
			interval: rule.interval,
			startDate: rule.startDate,
			endDate: rule.endDate,
		};

		const summary = { recorded: 0, pending: 0 };
		let date: string | null = rule.nextDate;
		while (date !== null && date <= today) {
			// A day already handled is never handled twice
			const [occurrence] = await tx
				.insert(recurringOccurrences)
				.values({
					recurringId: rule.id,
					householdId: rule.householdId,
					date,
					status: alone ? "recorded" : "pending",
				})
				.onConflictDoNothing()
				.returning({ id: recurringOccurrences.id });
			if (occurrence && alone) {
				const transactionId = await recordOccurrence(
					tx,
					rule,
					lines,
					date,
					household?.expenseSharing ?? false,
				);
				await tx
					.update(recurringOccurrences)
					.set({ transactionId })
					.where(eq(recurringOccurrences.id, occurrence.id));
				summary.recorded += 1;
			} else if (occurrence) {
				summary.pending += 1;
			}
			date = nextOccurrence(schedule, addDays(date, 1));
		}
		await tx
			.update(recurringTransactions)
			.set({ nextDate: date })
			.where(eq(recurringTransactions.id, rule.id));

		const topics: HouseholdEventTopic[] =
			summary.recorded > 0 ? ["recurring", "transactions"] : ["recurring"];
		for (const topic of topics) {
			await publishHouseholdEvent(tx, rule.householdId, topic);
		}
		return summary;
	});
}

/**
 * Handles every recurring transaction whose next day has come, in its
 * household's time zone. Each is handled on its own: one that fails is
 * logged, by its id only, and tried again on the next run.
 */
export async function runDueRecurrences(
	now: Date = new Date(),
): Promise<RunSummary> {
	// No day has started anywhere before it has started on the Line Islands,
	// the first time zone of the day
	const latestToday = todayIn("Pacific/Kiritimati", now);
	const due = await db
		.select({ id: recurringTransactions.id, timeZone: households.timeZone })
		.from(recurringTransactions)
		.innerJoin(households, eq(households.id, recurringTransactions.householdId))
		.where(lte(recurringTransactions.nextDate, latestToday))
		.orderBy(asc(recurringTransactions.nextDate));

	const summary = { recorded: 0, pending: 0 };
	for (const { id, timeZone } of due) {
		const today = todayIn(timeZone, now);
		try {
			const done = await runRecurring(id, today);
			summary.recorded += done.recorded;
			summary.pending += done.pending;
		} catch (error) {
			console.error(
				`[recurring] ${id} failed: ${error instanceof Error ? error.name : "unknown error"}`,
			);
		}
	}
	return summary;
}

/**
 * Runs `runDueRecurrences()` now, then every `everyMs`, one run at a time.
 * Returns what stops it.
 */
export function startRecurringTimer(everyMs: number): () => void {
	let running = false;
	const run = async () => {
		if (running) {
			return;
		}
		running = true;
		try {
			await runDueRecurrences();
		} catch (error) {
			console.error(
				`[recurring] The run failed: ${error instanceof Error ? error.name : "unknown error"}`,
			);
		} finally {
			running = false;
		}
	};
	void run();
	const timer = setInterval(run, everyMs);
	// The timer alone doesn't keep the process up
	timer.unref();
	return () => clearInterval(timer);
}
