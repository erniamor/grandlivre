import type { HouseholdEventTopic } from "@repo/schemas";
import type { InvalidateQueryFilters } from "@tanstack/react-query";
import { accountsQueryKey } from "@/features/accounts/accounts-query";
import { householdInvitationsQueryKey } from "@/features/households/household-invitations-query";
import { householdMembersQueryKey } from "@/features/households/household-members-query";
import { householdsQueryKey } from "@/features/households/households-query";
import { reportsQueryKey } from "@/features/reports/reports-query";
import { tagsQueryKey } from "@/features/tags/tags-query";
import { transactionsQueryKey } from "@/features/transactions/transactions-query";

/**
 * The user's households: their names, currencies, and the user's role. Its
 * key is the start of every household's keys: `exact`, or it would reload
 * everything. Always refetched, even when no page shows it: the routes read
 * the current household from it.
 */
const householdsFilter: InvalidateQueryFilters = {
	queryKey: householdsQueryKey,
	exact: true,
	refetchType: "all",
};

/** What a change of `topic` makes out of date, in the household's cache. */
export function staleQueries(
	householdId: string,
	topic: HouseholdEventTopic,
): InvalidateQueryFilters[] {
	switch (topic) {
		case "household":
			return [householdsFilter];
		case "members":
			// The user's own role may have changed
			return [
				householdsFilter,
				{ queryKey: householdMembersQueryKey(householdId) },
			];
		case "invitations":
			return [{ queryKey: householdInvitationsQueryKey(householdId) }];
		case "accounts":
			return [{ queryKey: accountsQueryKey(householdId) }];
		case "tags":
			return [{ queryKey: tagsQueryKey(householdId) }];
		case "transactions":
			// The balances of the accounts and the reports follow the transactions
			return [
				{ queryKey: transactionsQueryKey(householdId) },
				{ queryKey: accountsQueryKey(householdId) },
				{ queryKey: reportsQueryKey(householdId) },
			];
		case "recurring":
			return [{ queryKey: ["households", householdId, "recurring"] }];
	}
}

/**
 * Whether a change of `topic` concerns what the routes hold: the current
 * household and the user's role in it, read from the route context.
 */
export function changesRouteContext(topic: HouseholdEventTopic): boolean {
	return topic === "household" || topic === "members";
}

/** Everything of the household, after the stream was down. */
export function allHouseholdQueries(
	householdId: string,
): InvalidateQueryFilters[] {
	return [householdsFilter, { queryKey: [...householdsQueryKey, householdId] }];
}

/** The user's households, once the API refused the stream (e.g. removed). */
export function householdsQueries(): InvalidateQueryFilters[] {
	return [householdsFilter];
}
