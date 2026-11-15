/**
 * Stands in for the browser's EventSource in tests: records how it was
 * opened, and lets the test play the server's part.
 */
export class FakeEventSource extends EventTarget {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSED = 2;
	readonly CONNECTING = 0;
	readonly OPEN = 1;
	readonly CLOSED = 2;

	/** Every source opened, most recent last. */
	static instances: FakeEventSource[] = [];

	readonly url: string;
	readonly withCredentials: boolean;
	readyState = 0;

	constructor(url: string | URL, init?: EventSourceInit) {
		super();
		this.url = String(url);
		this.withCredentials = init?.withCredentials ?? false;
		FakeEventSource.instances.push(this);
	}

	close(): void {
		this.readyState = this.CLOSED;
	}

	/** The server sends a message: a named event, or an unnamed one. */
	emit(data: string, event = "message"): void {
		this.readyState = this.OPEN;
		this.dispatchEvent(new MessageEvent(event, { data }));
	}

	/** The connection breaks; `closed` once the browser gives up. */
	fail(closed = false): void {
		this.readyState = closed ? this.CLOSED : this.CONNECTING;
		this.dispatchEvent(new Event("error"));
	}
}
