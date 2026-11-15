import type { HouseholdEvent } from "@repo/schemas";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { publishHouseholdEvent, subscribeToHousehold } from "@/lib/events";

const HOME = "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f";
const OTHER = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

/** Collects the events of a household until `stop()` is called. */
async function listenTo(householdId: string) {
	const events: HouseholdEvent[] = [];
	const stop = await subscribeToHousehold(householdId, (event) => {
		events.push(event);
	});
	return { events, stop };
}

/** Long enough for an event that should not arrive to have arrived. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

describe("household events", () => {
	it("delivers an event to those who listen to the household", async () => {
		const first = await listenTo(HOME);
		const second = await listenTo(HOME);

		await publishHouseholdEvent(db, HOME, "transactions");

		await vi.waitFor(() => {
			expect(first.events).toEqual([{ topic: "transactions" }]);
			expect(second.events).toEqual([{ topic: "transactions" }]);
		});
		first.stop();
		second.stop();
	});

	it("keeps the events of a household from the others", async () => {
		const home = await listenTo(HOME);
		const other = await listenTo(OTHER);

		await publishHouseholdEvent(db, OTHER, "tags");

		await vi.waitFor(() => expect(other.events).toEqual([{ topic: "tags" }]));
		expect(home.events).toEqual([]);
		home.stop();
		other.stop();
	});

	it("delivers events in the order they were published", async () => {
		const { events, stop } = await listenTo(HOME);

		await publishHouseholdEvent(db, HOME, "accounts");
		await publishHouseholdEvent(db, HOME, "tags");
		await publishHouseholdEvent(db, HOME, "accounts");

		await vi.waitFor(() =>
			expect(events.map((event) => event.topic)).toEqual([
				"accounts",
				"tags",
				"accounts",
			]),
		);
		stop();
	});

	it("stops delivering once unsubscribed", async () => {
		const stopped = await listenTo(HOME);
		const kept = await listenTo(HOME);
		stopped.stop();

		await publishHouseholdEvent(db, HOME, "members");

		await vi.waitFor(() => expect(kept.events).toHaveLength(1));
		expect(stopped.events).toEqual([]);
		kept.stop();
	});

	it("delivers an event published in a transaction when it commits, not before", async () => {
		const { events, stop } = await listenTo(HOME);

		await db.transaction(async (tx) => {
			await publishHouseholdEvent(tx, HOME, "household");
			await settle();
			expect(events).toEqual([]);
		});

		await vi.waitFor(() => expect(events).toEqual([{ topic: "household" }]));
		stop();
	});

	it("never delivers an event published in a transaction that rolls back", async () => {
		const { events, stop } = await listenTo(HOME);

		await db
			.transaction(async (tx) => {
				await publishHouseholdEvent(tx, HOME, "household");
				throw new Error("Rolled back");
			})
			.catch(() => undefined);
		await settle();

		expect(events).toEqual([]);
		stop();
	});
});
