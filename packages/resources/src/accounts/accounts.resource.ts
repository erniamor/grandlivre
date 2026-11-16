import {
	type Account,
	type AccountsSummary,
	type AdjustAccount,
	type AdjustAccountResult,
	accountSchema,
	accountsSummarySchema,
	adjustAccountResultSchema,
	adjustAccountSchema,
	type CreateAccount,
	createAccountSchema,
	paginatedSchema,
	type UpdateAccount,
	updateAccountSchema,
} from "@repo/schemas";
import {
	type Page,
	type PageOptions,
	segment,
	toPage,
	withQuery,
} from "../api/page";
import { type ApiClient, parseInput } from "../http/client";

const accountsPageSchema = paginatedSchema(accountSchema);

const accountsPath = (householdId: string) =>
	`/households/${segment(householdId)}/accounts`;

const accountPath = (householdId: string, accountId: string) =>
	`${accountsPath(householdId)}/${segment(accountId)}`;

/**
 * The financial accounts of a household. Amounts are integers in minor units
 * of the household's currency (cents), negative for money owed. A household
 * the user isn't a member of, or an unknown account, rejects with a
 * NotFoundError; a change reserved to the account's holders with a
 * ForbiddenError.
 */
export function createAccountsResource(client: ApiClient) {
	return {
		/** Every account of the household, oldest first, as the user may see it. */
		async list(
			householdId: string,
			{ page, pageSize, signal }: PageOptions = {},
		): Promise<Page<Account>> {
			return toPage(
				await client.request({
					path: withQuery(accountsPath(householdId), { page, pageSize }),
					response: accountsPageSchema,
					signal,
				}),
			);
		},

		async get(
			householdId: string,
			accountId: string,
			options: { signal?: AbortSignal } = {},
		): Promise<Account> {
			return client.request({
				path: accountPath(householdId, accountId),
				response: accountSchema,
				signal: options.signal,
			});
		},

		/**
		 * The household's consolidated view: assets, liabilities and the net
		 * balance over every account.
		 */
		async summary(
			householdId: string,
			options: { signal?: AbortSignal } = {},
		): Promise<AccountsSummary> {
			return client.request({
				path: `${accountsPath(householdId)}/summary`,
				response: accountsSummarySchema,
				signal: options.signal,
			});
		},

		/**
		 * The user holds the new account; `holderIds`, when given, lists every
		 * holder, the user included.
		 */
		async create(householdId: string, input: CreateAccount): Promise<Account> {
			return client.request({
				method: "POST",
				path: accountsPath(householdId),
				body: parseInput(createAccountSchema, input),
				response: accountSchema,
			});
		},

		/** Holders only. Changes the fields given; `holderIds` replaces the holders. */
		async update(
			householdId: string,
			accountId: string,
			input: UpdateAccount,
		): Promise<Account> {
			return client.request({
				method: "PATCH",
				path: accountPath(householdId, accountId),
				body: parseInput(updateAccountSchema, input),
				response: accountSchema,
			});
		},

		/**
		 * Brings an account's balance to what it really holds on a day (the
		 * cash counted in a wallet, a bank's balance): the gap is recorded as
		 * an adjustment, an expense when it holds less, an income when it holds
		 * more; `adjustment` is null when there was none. Holders only.
		 */
		async adjust(
			householdId: string,
			accountId: string,
			input: AdjustAccount,
		): Promise<AdjustAccountResult> {
			return client.request({
				method: "POST",
				path: `${accountPath(householdId, accountId)}/adjust`,
				body: parseInput(adjustAccountSchema, input),
				response: adjustAccountResultSchema,
			});
		},

		/** Holders only. */
		async remove(householdId: string, accountId: string): Promise<void> {
			await client.request({
				method: "DELETE",
				path: accountPath(householdId, accountId),
			});
		},
	};
}

export type AccountsResource = ReturnType<typeof createAccountsResource>;
