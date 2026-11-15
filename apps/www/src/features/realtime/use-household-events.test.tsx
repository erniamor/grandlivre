import type { HouseholdEventHandlers } from "@repo/resources";
import { useSuspenseQuery } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { useHouseholdEvents } from "@/features/realtime/use-household-events";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import {
	base,
	household,
	respondWith,
} from "@/features/transactions/transaction-test-data";
import { transactionsQueryOptions } from "@/features/transactions/transactions-query";
import { getApi } from "@/lib/api";
import { mockApi } from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

afterEach(() => {
	vi.restoreAllMocks();
});

/** A page of the household that shows its accounts, tags and transactions. */
function HouseholdPage() {
	useHouseholdEvents(household.id);
	useSuspenseQuery(accountsQueryOptions(household.id));
	useSuspenseQuery(tagsQueryOptions(household.id));
	useSuspenseQuery(transactionsQueryOptions(household.id));
	return <p>Shown</p>;
}

async function setUp() {
	const requests = mockApi(respondWith());
	const api = getApi();
	let handlers: HouseholdEventHandlers | undefined;
	const unsubscribe = vi.fn();
	const subscribe = vi
		.spyOn(api.events, "subscribe")
		.mockImplementation((_householdId, given) => {
			handlers = given;
			return unsubscribe;
		});
	const { router, unmount } = renderWithRouter(<HouseholdPage />);
	const invalidate = vi.spyOn(router, "invalidate");
	await screen.findByText("Shown");
	/** How many times each path was read. */
	const reads = () => {
		const counts: Record<string, number> = {};
		for (const request of requests) {
			if (request.method === "GET") {
				const path = request.path.replace(base, "");
				counts[path] = (counts[path] ?? 0) + 1;
			}
		}
		return counts;
	};
	const before = reads();
	/** The paths read again since the page was shown. */
	const reloaded = () =>
		Object.entries(reads())
			.filter(([path, count]) => count > (before[path] ?? 0))
			.map(([path]) => path)
			.sort();
	const events = () => {
		if (!handlers) {
			throw new Error("Not subscribed");
		}
		return handlers;
	};
	return { subscribe, unsubscribe, unmount, invalidate, reloaded, events };
}

describe("useHouseholdEvents", () => {
	it("listens to the household's events while the page is open, and stops after", async () => {
		const { subscribe, unsubscribe, unmount } = await setUp();

		expect(subscribe).toHaveBeenCalledOnce();
		expect(subscribe.mock.calls[0]?.[0]).toBe(household.id);
		expect(unsubscribe).not.toHaveBeenCalled();
		unmount();
		expect(unsubscribe).toHaveBeenCalledOnce();
	});

	it("reloads the transactions and the balances when a transaction changes", async () => {
		const { events, reloaded, invalidate } = await setUp();

		events().onEvent({ topic: "transactions" });

		await vi.waitFor(() =>
			expect(reloaded()).toEqual(["/accounts", "/transactions"]),
		);
		expect(invalidate).not.toHaveBeenCalled();
	});

	it("reloads only the tags when a tag changes", async () => {
		const { events, reloaded } = await setUp();

		events().onEvent({ topic: "tags" });

		await vi.waitFor(() => expect(reloaded()).toEqual(["/tags"]));
	});

	it("re-runs the routes when the household or its members change", async () => {
		const { events, invalidate } = await setUp();

		events().onEvent({ topic: "household" });
		await vi.waitFor(() => expect(invalidate).toHaveBeenCalledOnce());
		events().onEvent({ topic: "members" });
		await vi.waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));
	});

	it("reloads everything shown once the stream is ready, to catch up on what was missed", async () => {
		const { events, reloaded, invalidate } = await setUp();

		events().onReady?.();

		await vi.waitFor(() =>
			expect(reloaded()).toEqual(["/accounts", "/tags", "/transactions"]),
		);
		// Once the data is back: the routes then read it fresh
		await vi.waitFor(() => expect(invalidate).toHaveBeenCalledOnce());
	});

	it("re-runs the routes once the API refuses the stream for good, not while it reconnects", async () => {
		const { events, invalidate, reloaded } = await setUp();

		events().onError?.({ closed: false });
		expect(invalidate).not.toHaveBeenCalled();

		events().onError?.({ closed: true });
		await vi.waitFor(() => expect(invalidate).toHaveBeenCalledOnce());
		expect(reloaded()).toEqual([]);
	});
});
