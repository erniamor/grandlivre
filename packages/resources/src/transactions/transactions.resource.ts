import {
	type CreateTransaction,
	createTransactionSchema,
	paginatedSchema,
	type Transaction,
	type TransactionType,
	transactionSchema,
	type UpdateTransaction,
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

const transactionsPageSchema = paginatedSchema(transactionSchema);

const transactionsPath = (householdId: string) =>
	`/households/${segment(householdId)}/transactions`;

const transactionPath = (householdId: string, transactionId: string) =>
	`${transactionsPath(householdId)}/${segment(transactionId)}`;

/** What narrows a list of transactions; every filter is optional. */
export interface TransactionFilters {
	/** The transactions of this account, transfers it receives included. */
	accountId?: string;
	/** The transactions with a line on this tag or on a tag under it. */
	tagId?: string;
	type?: TransactionType;
	/** From this day on, included: "2026-11-01". */
	from?: string;
	/** Up to this day, included. */
	to?: string;
}

/**
 * The transactions of a household: expenses, incomes and transfers between
 * its accounts. Amounts are positive integers in minor units of the
 * household's currency (cents); the type says which way the money goes.
 * A transaction the user may not see (unknown, or on an account that only
 * shows its balance) rejects with a NotFoundError; a change on an account
 * they don't hold with a ForbiddenError.
 */
export function createTransactionsResource(client: ApiClient) {
	return {
		/** The transactions the user may see, the most recent day first. */
		async list(
			householdId: string,
			{
				page,
				pageSize,
				signal,
				...filters
			}: PageOptions & TransactionFilters = {},
		): Promise<Page<Transaction>> {
			return toPage(
				await client.request({
					path: withQuery(transactionsPath(householdId), {
						...filters,
						page,
						pageSize,
					}),
					response: transactionsPageSchema,
					signal,
				}),
			);
		},

		async get(
			householdId: string,
			transactionId: string,
			options: { signal?: AbortSignal } = {},
		): Promise<Transaction> {
			return client.request({
				path: transactionPath(householdId, transactionId),
				response: transactionSchema,
				signal: options.signal,
			});
		},

		/**
		 * Records a transaction on an account the user holds. An account or a
		 * tag from outside the household rejects with a ValidationError on its
		 * field; an archived account with an ApiError `account_archived` (409).
		 */
		async create(
			householdId: string,
			input: CreateTransaction,
		): Promise<Transaction> {
			return client.request({
				method: "POST",
				path: transactionsPath(householdId),
				body: parseInput(createTransactionSchema, input),
				response: transactionSchema,
			});
		},

		/**
		 * Replaces a transaction with the one given, as a whole: what isn't
		 * given again is lost. Rejects like `create()`.
		 */
		async replace(
			householdId: string,
			transactionId: string,
			input: UpdateTransaction,
		): Promise<Transaction> {
			return client.request({
				method: "PUT",
				path: transactionPath(householdId, transactionId),
				body: parseInput(updateTransactionSchema, input),
				response: transactionSchema,
			});
		},

		async remove(householdId: string, transactionId: string): Promise<void> {
			await client.request({
				method: "DELETE",
				path: transactionPath(householdId, transactionId),
			});
		},
	};
}

export type TransactionsResource = ReturnType<
	typeof createTransactionsResource
>;
