import { type HouseholdEvent, householdEventSchema } from "@repo/schemas";
import { segment } from "../api/page";
import type { ApiClient } from "../http/client";

export interface HouseholdEventHandlers {
	/** Something changed in the household: reload what shows it. */
	onEvent: (event: HouseholdEvent) => void;
	/**
	 * The stream is listened to, at first and after each reconnection: what
	 * changed while it was down wasn't told, so reload everything then.
	 */
	onReady?: () => void;
	/**
	 * The stream broke. `closed` is false while the browser tries to
	 * reconnect by itself, true once it gave up: the API refused the stream
	 * (signed out, no longer a member) and won't be asked again.
	 */
	onError?: (error: { closed: boolean }) => void;
}

/**
 * What changes in a household, as it happens: each event names what changed
 * and carries no data. Uses the browser's EventSource, which reconnects by
 * itself after a network error.
 */
export function createEventsResource(client: ApiClient) {
	return {
		/** Listens to a household's events until the function returned is called. */
		subscribe(
			householdId: string,
			{ onEvent, onReady, onError }: HouseholdEventHandlers,
		): () => void {
			const source = client.openEventSource(
				`/households/${segment(householdId)}/events`,
			);
			source.addEventListener("ready", () => onReady?.());
			source.addEventListener("message", (message) => {
				let data: unknown;
				try {
					data = JSON.parse(String(message.data));
				} catch {
					return;
				}
				// An event this version doesn't know: ignored, not a failure
				const event = householdEventSchema.safeParse(data);
				if (event.success) {
					onEvent(event.data);
				}
			});
			source.addEventListener("error", () => {
				onError?.({ closed: source.readyState === source.CLOSED });
			});
			return () => source.close();
		},
	};
}

export type EventsResource = ReturnType<typeof createEventsResource>;
