import type { HouseholdEvent } from "@repo/schemas";
import { api } from "@test/helpers/api";

/**
 * Opens the stream of a household's events, as the browser's EventSource
 * would, and waits until the API listens. `events` fills as they arrive.
 */
export async function openEvents(householdId: string, cookie?: string) {
	const controller = new AbortController();
	const response = await api(`/v1/households/${householdId}/events`, {
		cookie,
		signal: controller.signal,
	});
	const events: HouseholdEvent[] = [];
	let connected = false;
	let ended = false;

	const reader = response.body?.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	const reading = (async () => {
		if (!response.ok || !reader) {
			return;
		}
		try {
			for (;;) {
				const { done, value } = await reader.read();
				if (done) {
					break;
				}
				buffer += decoder.decode(value, { stream: true });
				// Messages are separated by a blank line
				const messages = buffer.split("\n\n");
				buffer = messages.pop() ?? "";
				for (const message of messages) {
					if (message.startsWith("event: ready")) {
						connected = true;
						continue;
					}
					const data = message
						.split("\n")
						.find((line) => line.startsWith("data: "));
					if (data) {
						events.push(JSON.parse(data.slice("data: ".length)));
					}
				}
			}
		} catch {
			// Closed by the test
		} finally {
			ended = true;
		}
	})();

	if (response.ok) {
		const deadline = Date.now() + 5000;
		while (!connected && !ended && Date.now() < deadline) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
	}

	return {
		response,
		events,
		/** The topics received so far, in order. */
		topics: () => events.map((event) => event.topic),
		/** Whether the API closed the stream. */
		ended: () => ended,
		/** Closes the stream from the client's side. */
		async close() {
			controller.abort();
			await reader?.cancel().catch(() => undefined);
			await reading;
		},
	};
}
