import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { subscribeToHousehold } from "@/lib/events";
import type { HouseholdVariables } from "@/middlewares/require-household";
import { findMembership } from "@/routes/households/households.service";

/** Keeps proxies from closing a stream on which nothing is said for a while. */
const HEARTBEAT_MS = 25_000;

/**
 * The stream of what changes in a household (Server-Sent Events). Mounted
 * under `/households/:householdId/events`, behind `requireHouseholdMember`.
 */
export const eventRoutes = new Hono<{ Variables: HouseholdVariables }>().get(
	"/",
	(c) => {
		const householdId = c.get("membership").household.id;
		const userId = c.get("user").id;
		// Asks proxies (nginx and the like) not to hold the events back
		c.header("X-Accel-Buffering", "no");

		return streamSSE(c, async (stream) => {
			let end: () => void = () => {};
			const ended = new Promise<void>((resolve) => {
				end = resolve;
			});
			stream.onAbort(end);

			let closed = false;
			ended.then(() => {
				closed = true;
			});
			// Events are handled one after the other, in the order they came:
			// once the user is found to have left, nothing after reaches them
			let queue = Promise.resolve();
			const unsubscribe = await subscribeToHousehold(householdId, (event) => {
				queue = queue
					.then(async () => {
						if (closed) {
							return;
						}
						// Someone left the household or was removed from it: the
						// stream of a user who is no longer a member stops
						if (
							event.topic === "members" &&
							!(await findMembership(householdId, userId))
						) {
							closed = true;
							end();
							return;
						}
						await stream.writeSSE({ data: JSON.stringify(event) });
					})
					.catch(end);
			});
			const heartbeat = setInterval(() => {
				// A comment: ignored by the browser, seen by the proxies
				stream.write(": ping\n\n").catch(end);
			}, HEARTBEAT_MS);
			// Doesn't keep the process alive by itself
			heartbeat.unref();

			try {
				// Events are now listened to: the client can reload its data and
				// rely on the stream from here on. A named event, not a comment,
				// so the browser sees it; with data, or the browser drops it.
				await stream.writeSSE({ event: "ready", data: "{}" });
				await ended;
			} finally {
				clearInterval(heartbeat);
				unsubscribe();
			}
		});
	},
);
