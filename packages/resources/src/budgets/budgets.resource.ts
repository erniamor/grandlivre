import {
	type Budget,
	type BudgetSuggestion,
	type BudgetsMonth,
	budgetSchema,
	budgetSuggestionSchema,
	budgetsMonthSchema,
	monthSchema,
	type SetBudget,
	setBudgetSchema,
} from "@repo/schemas";
import { z } from "zod";
import { segment, withQuery } from "../api/page";
import { type ApiClient, parseInput } from "../http/client";

const budgetsPath = (householdId: string) =>
	`/households/${segment(householdId)}/budgets`;

const budgetPath = (householdId: string, tagId: string) =>
	`${budgetsPath(householdId)}/${segment(tagId)}`;

const monthInputSchema = z.object({ month: monthSchema });

/**
 * The budgets of a household: what it means to spend on a tag (and the
 * tags under it) each month or each year, set from a month on. Shared and
 * managed by every member. A tag from outside the household rejects with a
 * NotFoundError.
 */
export function createBudgetsResource(client: ApiClient) {
	return {
		/**
		 * The budgets in force in a month ("2026-11"; the household's current
		 * month when missing), with what was spent and what is planned.
		 */
		async list(
			householdId: string,
			{ month, signal }: { month?: string; signal?: AbortSignal } = {},
		): Promise<BudgetsMonth> {
			if (month !== undefined) {
				parseInput(monthInputSchema, { month });
			}
			return client.request({
				path: withQuery(budgetsPath(householdId), { month }),
				response: budgetsMonthSchema,
				signal,
			});
		},

		/**
		 * Sets the budget of a tag from a month on, replacing any later change;
		 * the months before keep theirs.
		 */
		async set(
			householdId: string,
			tagId: string,
			input: SetBudget,
		): Promise<Budget> {
			return client.request({
				method: "PUT",
				path: budgetPath(householdId, tagId),
				body: parseInput(setBudgetSchema, input),
				response: budgetSchema,
			});
		},

		/** Stops the budget of a tag from a month on; the months before keep it. */
		async stop(
			householdId: string,
			tagId: string,
			from: string,
		): Promise<void> {
			parseInput(z.object({ from: monthSchema }), { from });
			await client.request({
				method: "DELETE",
				path: withQuery(budgetPath(householdId, tagId), { from }),
			});
		},

		/**
		 * What a tag usually costs before a month: the average of the 3
		 * previous months (`month`), the sum of the 12 previous ones (`year`).
		 */
		async suggestion(
			householdId: string,
			tagId: string,
			{ month, signal }: { month?: string; signal?: AbortSignal } = {},
		): Promise<BudgetSuggestion> {
			if (month !== undefined) {
				parseInput(monthInputSchema, { month });
			}
			return client.request({
				path: withQuery(`${budgetPath(householdId, tagId)}/suggestion`, {
					month,
				}),
				response: budgetSuggestionSchema,
				signal,
			});
		},
	};
}

export type BudgetsResource = ReturnType<typeof createBudgetsResource>;
