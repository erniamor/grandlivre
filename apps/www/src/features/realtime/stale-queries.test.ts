import { HOUSEHOLD_EVENT_TOPICS } from "@repo/schemas";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
	allHouseholdQueries,
	changesRouteContext,
	staleQueries,
} from "@/features/realtime/stale-queries";

const HOME = "home";

/** The keys a household's pages cache, as the features build them. */
const cached = [
	["households"],
	["households", HOME, "members"],
	["households", HOME, "invitations"],
	["households", HOME, "accounts", "list"],
	["households", HOME, "accounts", "summary"],
	["households", HOME, "tags"],
	["households", HOME, "suggested-tags"],
	["households", HOME, "transactions", "list", { page: 1 }],
	["households", HOME, "reports", "tags", "2026-11-01", "2026-11-30"],
	["households", HOME, "recurring", "list"],
	["households", HOME, "budgets", "month", "2026-11"],
	["households", "elsewhere", "transactions", "list", { page: 1 }],
	["me"],
	["invitations", "received"],
];

/** The cached keys a list of filters makes out of date, in cache order. */
function staleKeys(filters: ReturnType<typeof staleQueries>) {
	const client = new QueryClient();
	for (const queryKey of cached) {
		client.setQueryData(queryKey, "data");
	}
	const stale = new Set(
		filters.flatMap((filter) =>
			client
				.getQueryCache()
				.findAll({ queryKey: filter.queryKey, exact: filter.exact }),
		),
	);
	return client
		.getQueryCache()
		.getAll()
		.filter((query) => stale.has(query))
		.map((query) => query.queryKey);
}

describe("staleQueries", () => {
	it.each([
		["household", [["households"]]],
		["members", [["households"], ["households", HOME, "members"]]],
		["invitations", [["households", HOME, "invitations"]]],
		[
			"accounts",
			[
				["households", HOME, "accounts", "list"],
				["households", HOME, "accounts", "summary"],
			],
		],
		[
			"tags",
			[
				["households", HOME, "tags"],
				["households", HOME, "budgets", "month", "2026-11"],
			],
		],
		[
			"transactions",
			[
				["households", HOME, "accounts", "list"],
				["households", HOME, "accounts", "summary"],
				["households", HOME, "transactions", "list", { page: 1 }],
				["households", HOME, "reports", "tags", "2026-11-01", "2026-11-30"],
				["households", HOME, "budgets", "month", "2026-11"],
			],
		],
		[
			"recurring",
			[
				["households", HOME, "recurring", "list"],
				["households", HOME, "budgets", "month", "2026-11"],
			],
		],
		["budgets", [["households", HOME, "budgets", "month", "2026-11"]]],
	] as const)(
		"reloads after a change of %s what shows it, and nothing else",
		(topic, keys) => {
			expect(staleKeys(staleQueries(HOME, topic))).toEqual(keys);
		},
	);

	it("knows every topic the API sends", () => {
		for (const topic of HOUSEHOLD_EVENT_TOPICS) {
			expect(staleQueries(HOME, topic).length).toBeGreaterThan(0);
		}
	});
});

describe("allHouseholdQueries", () => {
	it("reloads everything of the household, and of no other", () => {
		expect(staleKeys(allHouseholdQueries(HOME))).toEqual([
			["households"],
			["households", HOME, "members"],
			["households", HOME, "invitations"],
			["households", HOME, "accounts", "list"],
			["households", HOME, "accounts", "summary"],
			["households", HOME, "tags"],
			["households", HOME, "suggested-tags"],
			["households", HOME, "transactions", "list", { page: 1 }],
			["households", HOME, "reports", "tags", "2026-11-01", "2026-11-30"],
			["households", HOME, "recurring", "list"],
			["households", HOME, "budgets", "month", "2026-11"],
		]);
	});
});

describe("changesRouteContext", () => {
	it("re-runs the routes when the household or its members change", () => {
		expect(
			HOUSEHOLD_EVENT_TOPICS.filter((topic) => changesRouteContext(topic)),
		).toEqual(["household", "members"]);
	});
});
