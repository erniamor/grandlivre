import {
	type HouseholdEvent,
	type HouseholdEventTopic,
	householdEventSchema,
} from "@repo/schemas";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { client, type db, type Transaction } from "@/db/client";

// Events travel through PostgreSQL (LISTEN/NOTIFY) rather than through this
// process's memory: a member connected to one instance of the API hears
// about a change made on another.
const CHANNEL = "household_events";

const messageSchema = z.object({
	householdId: z.string(),
	event: householdEventSchema,
});

type Listener = (event: HouseholdEvent) => void;

const listeners = new Map<string, Set<Listener>>();

function dispatch(payload: string): void {
	let message: z.infer<typeof messageSchema>;
	try {
		message = messageSchema.parse(JSON.parse(payload));
	} catch {
		// Not one of ours: ignore it rather than break the other listeners
		return;
	}
	for (const listener of listeners.get(message.householdId) ?? []) {
		listener(message.event);
	}
}

let listening: Promise<unknown> | undefined;

/** Opens the connection that listens to PostgreSQL, once, on first use. */
function listen(): Promise<unknown> {
	listening ??= client.listen(CHANNEL, dispatch).catch((error: unknown) => {
		// Let the next subscription try again
		listening = undefined;
		throw error;
	});
	return listening;
}

/**
 * Tells the members of a household that something changed in it. Call it
 * with the transaction that makes the change: PostgreSQL then delivers the
 * event when the transaction commits, and never if it rolls back.
 */
export async function publishHouseholdEvent(
	database: typeof db | Transaction,
	householdId: string,
	topic: HouseholdEventTopic,
): Promise<void> {
	const message: z.infer<typeof messageSchema> = {
		householdId,
		event: { topic },
	};
	// Raw SQL: NOTIFY has no Drizzle helper. pg_notify() takes its payload
	// as a parameter, unlike the NOTIFY statement.
	await database.execute(
		sql`select pg_notify(${CHANNEL}, ${JSON.stringify(message)})`,
	);
}

/**
 * Calls `listener` for each event of the household, until the function
 * returned is called. Resolves once events are being listened to.
 */
export async function subscribeToHousehold(
	householdId: string,
	listener: Listener,
): Promise<() => void> {
	const ofHousehold = listeners.get(householdId) ?? new Set<Listener>();
	listeners.set(householdId, ofHousehold);
	ofHousehold.add(listener);
	const unsubscribe = () => {
		ofHousehold.delete(listener);
		if (ofHousehold.size === 0) {
			listeners.delete(householdId);
		}
	};
	try {
		await listen();
	} catch (error) {
		unsubscribe();
		throw error;
	}
	return unsubscribe;
}
