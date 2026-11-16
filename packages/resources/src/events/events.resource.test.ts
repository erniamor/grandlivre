import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApi } from "../index";
import { FakeEventSource } from "../test/fake-event-source";

const HOUSEHOLD_ID = "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f";

beforeEach(() => {
	FakeEventSource.instances = [];
});

function subscribe(credentials?: RequestCredentials) {
	const api = createApi({
		baseUrl: "http://api.test",
		credentials,
		EventSource: FakeEventSource as unknown as typeof EventSource,
	});
	const handlers = {
		onEvent: vi.fn(),
		onReady: vi.fn(),
		onError: vi.fn(),
	};
	const unsubscribe = api.events.subscribe(HOUSEHOLD_ID, handlers);
	const source = FakeEventSource.instances.at(-1);
	if (!source) {
		throw new Error("No event source was opened");
	}
	return { ...handlers, unsubscribe, source };
}

describe("events", () => {
	it("opens the household's stream, with the session cookie in the browser", () => {
		const { source } = subscribe("include");

		expect(source.url).toBe(
			`http://api.test/v1/households/${HOUSEHOLD_ID}/events`,
		);
		expect(source.withCredentials).toBe(true);
	});

	it("doesn't ask for cookies when the client doesn't send them", () => {
		expect(subscribe().source.withCredentials).toBe(false);
	});

	it("keeps an identifier from changing the requested path", () => {
		const api = createApi({
			baseUrl: "http://api.test",
			EventSource: FakeEventSource as unknown as typeof EventSource,
		});

		api.events.subscribe("../me", { onEvent: vi.fn() });

		expect(FakeEventSource.instances[0]?.url).toBe(
			"http://api.test/v1/households/..%2Fme/events",
		);
	});

	it("says when the stream is listened to, at first and after each reconnection", () => {
		const { source, onReady } = subscribe();

		source.emit("{}", "ready");
		source.fail();
		source.emit("{}", "ready");

		expect(onReady).toHaveBeenCalledTimes(2);
	});

	it("passes on each event, read and checked", () => {
		const { source, onEvent } = subscribe();

		source.emit('{"topic":"transactions"}');
		source.emit('{"topic":"tags"}');

		expect(onEvent.mock.calls).toEqual([
			[{ topic: "transactions" }],
			[{ topic: "tags" }],
		]);
	});

	it("ignores what isn't a known event, rather than fail", () => {
		const { source, onEvent } = subscribe();

		source.emit("not json");
		source.emit('{"topic":"not-a-topic"}');
		source.emit('{"topic":"tags"}');

		expect(onEvent.mock.calls).toEqual([[{ topic: "tags" }]]);
	});

	it("tells a break the browser will recover from from one it gave up on", () => {
		const { source, onError } = subscribe();

		source.fail();
		source.fail(true);

		expect(onError.mock.calls).toEqual([
			[{ closed: false }],
			[{ closed: true }],
		]);
	});

	it("works without the optional handlers", () => {
		const api = createApi({
			baseUrl: "http://api.test",
			EventSource: FakeEventSource as unknown as typeof EventSource,
		});
		api.events.subscribe(HOUSEHOLD_ID, { onEvent: vi.fn() });
		const source = FakeEventSource.instances[0];

		expect(() => {
			source?.emit("{}", "ready");
			source?.fail(true);
		}).not.toThrow();
	});

	it("closes the stream when unsubscribed", () => {
		const { source, unsubscribe } = subscribe();

		unsubscribe();

		expect(source.readyState).toBe(FakeEventSource.CLOSED);
	});
});
