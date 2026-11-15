import {
	type CreateRecurringTransaction,
	createRecurringTransactionSchema,
	type PendingOccurrence,
	paginatedSchema,
	pendingOccurrenceSchema,
	type RecurringTransaction,
	recurringTransactionSchema,
	type Transaction,
	transactionSchema,
	type UpcomingOccurrence,
	type UpdateRecurringTransaction,
	type UpdateTransaction,
	upcomingOccurrenceSchema,
	updateRecurringTransactionSchema,
	updateTransactionSchema,
} from "@repo/schemas";
import {
	type Page,
	type PageOptions,
	segment,
	toPage,
	withQuery,
} from "../api/page";
import { type ApiClient, parseInput } from "../http/client";

const recurringPageSchema = paginatedSchema(recurringTransactionSchema);
const pendingPageSchema = paginatedSchema(pendingOccurrenceSchema);
const upcomingPageSchema = paginatedSchema(upcomingOccurrenceSchema);

const recurringBase = (householdId: string) =>
	`/households/${segment(householdId)}/recurring-transactions`;

const recurringPath = (householdId: string, recurringId: string) =>
	`${recurringBase(householdId)}/${segment(recurringId)}`;

const pendingPath = (householdId: string, occurrenceId: string) =>
	`${recurringBase(householdId)}/pending/${segment(occurrenceId)}`;

/**
 * The recurring transactions of a household: what each records, and when
 * (`schedule`), `automatic`ally or once a member confirms it. The API
 * records their days itself; this resource reads and changes them, and
 * handles the days waiting for a member. Visibility and rights follow their
 * account, as for transactions: NotFoundError for one the user may not
 * see, ForbiddenError for a change on an account they don't hold.
 */
export function createRecurringResource(client: ApiClient) {
	return {
		/** The recurring transactions the user may see, the next due first. */
		async list(
			householdId: string,
			{ page, pageSize, signal }: PageOptions = {},
		): Promise<Page<RecurringTransaction>> {
			return toPage(
				await client.request({
					path: withQuery(recurringBase(householdId), { page, pageSize }),
					response: recurringPageSchema,
					signal,
				}),
			);
		},

		async get(
			householdId: string,
			recurringId: string,
			options: { signal?: AbortSignal } = {},
		): Promise<RecurringTransaction> {
			return client.request({
				path: recurringPath(householdId, recurringId),
				response: recurringTransactionSchema,
				signal: options.signal,
			});
		},

		/**
		 * Creates a recurring transaction on an account the user holds. A first
		 * day already past, in the household's time zone, rejects with a
		 * ValidationError `recurrence_start_in_past` on `schedule.startDate`.
		 */
		async create(
			householdId: string,
			input: CreateRecurringTransaction,
		): Promise<RecurringTransaction> {
			return client.request({
				method: "POST",
				path: recurringBase(householdId),
				body: parseInput(createRecurringTransactionSchema, input),
				response: recurringTransactionSchema,
			});
		},

		/**
		 * Replaces a recurring transaction. The transactions it recorded stay;
		 * an unchanged schedule keeps its next day.
		 */
		async replace(
			householdId: string,
			recurringId: string,
			input: UpdateRecurringTransaction,
		): Promise<RecurringTransaction> {
			return client.request({
				method: "PUT",
				path: recurringPath(householdId, recurringId),
				body: parseInput(updateRecurringTransactionSchema, input),
				response: recurringTransactionSchema,
			});
		},

		/** Deletes a recurring transaction; the transactions it recorded stay. */
		async remove(householdId: string, recurringId: string): Promise<void> {
			await client.request({
				method: "DELETE",
				path: recurringPath(householdId, recurringId),
			});
		},

		/** The days waiting for a member to confirm or skip them, the oldest first. */
		async pending(
			householdId: string,
			{ page, pageSize, signal }: PageOptions = {},
		): Promise<Page<PendingOccurrence>> {
			return toPage(
				await client.request({
					path: withQuery(`${recurringBase(householdId)}/pending`, {
						page,
						pageSize,
					}),
					response: pendingPageSchema,
					signal,
				}),
			);
		},

		/**
		 * Records a waiting day as the user reviewed it. A day already recorded
		 * or skipped rejects with an ApiError `occurrence_already_handled` (409).
		 */
		async confirm(
			householdId: string,
			occurrenceId: string,
			transaction: UpdateTransaction,
		): Promise<Transaction> {
			return client.request({
				method: "POST",
				path: `${pendingPath(householdId, occurrenceId)}/confirm`,
				body: parseInput(updateTransactionSchema, transaction),
				response: transactionSchema,
			});
		},

		/** Skips a waiting day: nothing is recorded for it. */
		async skip(householdId: string, occurrenceId: string): Promise<void> {
			await client.request({
				method: "POST",
				path: `${pendingPath(householdId, occurrenceId)}/skip`,
			});
		},

		/**
		 * The days to come, the soonest first, from today to `days` after (30
		 * by default, UPCOMING_MAX_DAYS at most).
		 */
		async upcoming(
			householdId: string,
			{ days, page, pageSize, signal }: PageOptions & { days?: number } = {},
		): Promise<Page<UpcomingOccurrence>> {
			return toPage(
				await client.request({
					path: withQuery(`${recurringBase(householdId)}/upcoming`, {
						days,
						page,
						pageSize,
					}),
					response: upcomingPageSchema,
					signal,
				}),
			);
		},
	};
}

export type RecurringResource = ReturnType<typeof createRecurringResource>;
