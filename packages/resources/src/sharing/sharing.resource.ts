import {
	type CreateSettlement,
	createSettlementSchema,
	paginatedSchema,
	type Settlement,
	type SharedExpense,
	type SharingOverview,
	settlementSchema,
	sharedExpenseSchema,
	sharingOverviewSchema,
	type UpdateSharingWeights,
	updateSharingWeightsSchema,
} from "@repo/schemas";
import {
	type Page,
	type PageOptions,
	segment,
	toPage,
	withQuery,
} from "../api/page";
import { type ApiClient, parseInput } from "../http/client";

const expensesPageSchema = paginatedSchema(sharedExpenseSchema);
const settlementsPageSchema = paginatedSchema(settlementSchema);

const sharingPath = (householdId: string) =>
	`/households/${segment(householdId)}/sharing`;

/**
 * Settling shared expenses between members, for the households that turn
 * it on (`expenseSharing`, through `households.update`). While it is off,
 * every operation rejects with an ApiError `sharing_disabled` (409). A
 * transaction is shared through its `shares`, with `transactions.create`
 * and `transactions.replace`.
 */
export function createSharingResource(client: ApiClient) {
	return {
		/**
		 * Each member's balance (positive when the others owe them), the
		 * default split, and the fewest payments that settle everything.
		 */
		async overview(
			householdId: string,
			options: { signal?: AbortSignal } = {},
		): Promise<SharingOverview> {
			return client.request({
				path: sharingPath(householdId),
				response: sharingOverviewSchema,
				signal: options.signal,
			});
		},

		/** Sets the household's default split; for its owners. */
		async setWeights(
			householdId: string,
			input: UpdateSharingWeights,
		): Promise<SharingOverview> {
			return client.request({
				method: "PUT",
				path: `${sharingPath(householdId)}/weights`,
				body: parseInput(updateSharingWeightsSchema, input),
				response: sharingOverviewSchema,
			});
		},

		/** The shared transactions the user is concerned by, the most recent first. */
		async expenses(
			householdId: string,
			{ page, pageSize, signal }: PageOptions = {},
		): Promise<Page<SharedExpense>> {
			return toPage(
				await client.request({
					path: withQuery(`${sharingPath(householdId)}/expenses`, {
						page,
						pageSize,
					}),
					response: expensesPageSchema,
					signal,
				}),
			);
		},

		/** The settlements, the most recent first. */
		async settlements(
			householdId: string,
			{ page, pageSize, signal }: PageOptions = {},
		): Promise<Page<Settlement>> {
			return toPage(
				await client.request({
					path: withQuery(`${sharingPath(householdId)}/settlements`, {
						page,
						pageSize,
					}),
					response: settlementsPageSchema,
					signal,
				}),
			);
		},

		/**
		 * Records a payment between two members, by one of them; with
		 * `transfer`, also as a transfer between their accounts.
		 */
		async settle(
			householdId: string,
			input: CreateSettlement,
		): Promise<Settlement> {
			return client.request({
				method: "POST",
				path: `${sharingPath(householdId)}/settlements`,
				body: parseInput(createSettlementSchema, input),
				response: settlementSchema,
			});
		},

		/** Deletes a settlement, with the transfer recorded with it. */
		async removeSettlement(
			householdId: string,
			settlementId: string,
		): Promise<void> {
			await client.request({
				method: "DELETE",
				path: `${sharingPath(householdId)}/settlements/${segment(settlementId)}`,
			});
		},
	};
}

export type SharingResource = ReturnType<typeof createSharingResource>;
