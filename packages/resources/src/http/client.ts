import type { z } from "zod";
import { toApiError, toInputError } from "../api/errors";
import { NetworkError, ServerError } from "../errors";

export interface ApiClientConfig {
	/** URL of the API, without the version, e.g. "http://localhost:3001". */
	baseUrl: string;
	/**
	 * Headers added to every request, read at each call: the session cookie
	 * forwarded during server rendering, the user's language...
	 */
	headers?: () => Record<string, string | undefined>;
	/** "include" in the browser, so the session cookie is sent to the API. */
	credentials?: RequestCredentials;
	/** Replaces the global fetch, e.g. in tests. */
	fetch?: typeof fetch;
	/** Replaces the global EventSource, e.g. in tests. */
	EventSource?: typeof EventSource;
}

interface RequestOptions<Output> {
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	/** Path under /v1, e.g. "/me". */
	path: string;
	/**
	 * Sent as JSON; a FormData is sent as a multipart form, with the
	 * Content-Type (and its boundary) set by fetch.
	 */
	body?: unknown;
	/** Schema of the response; omit for responses with no useful body. */
	response?: z.ZodType<Output>;
	signal?: AbortSignal;
}

export interface ApiClient {
	request<Output = void>(options: RequestOptions<Output>): Promise<Output>;
	/**
	 * Opens a stream of server-sent events at a path under /v1, with the
	 * session cookie when `credentials` is "include".
	 */
	openEventSource(path: string): EventSource;
}

/** Validates an input before sending it: invalid input throws a ValidationError. */
export function parseInput<Schema extends z.ZodType>(
	schema: Schema,
	input: unknown,
): z.output<Schema> {
	const result = schema.safeParse(input);
	if (!result.success) {
		throw toInputError(result.error);
	}
	return result.data;
}

function isAbort(error: unknown): boolean {
	return error instanceof Error && error.name === "AbortError";
}

export function createApiClient(config: ApiClientConfig): ApiClient {
	const doFetch = config.fetch ?? globalThis.fetch;

	return {
		async request<Output>({
			method = "GET",
			path,
			body,
			response: responseSchema,
			signal,
		}: RequestOptions<Output>): Promise<Output> {
			const headers: Record<string, string> = { Accept: "application/json" };
			for (const [name, value] of Object.entries(config.headers?.() ?? {})) {
				if (value !== undefined) {
					headers[name] = value;
				}
			}
			const isForm = body instanceof FormData;
			if (body !== undefined && !isForm) {
				headers["Content-Type"] = "application/json";
			}

			let response: Response;
			try {
				response = await doFetch(`${config.baseUrl}/v1${path}`, {
					method,
					headers,
					body: isForm
						? body
						: body === undefined
							? undefined
							: JSON.stringify(body),
					credentials: config.credentials,
					signal,
				});
			} catch (error) {
				// A cancellation is the caller's decision, not a network failure
				if (isAbort(error)) {
					throw error;
				}
				throw new NetworkError(error);
			}

			const json: unknown =
				response.status === 204
					? undefined
					: await response.json().catch(() => undefined);
			if (!response.ok) {
				throw toApiError(response.status, json);
			}
			if (!responseSchema) {
				return undefined as Output;
			}
			const parsed = responseSchema.safeParse(json);
			if (!parsed.success) {
				throw new ServerError(
					response.status,
					"unexpected_response",
					`Unexpected response from ${method} ${path}`,
				);
			}
			return parsed.data;
		},

		openEventSource(path: string): EventSource {
			const Source = config.EventSource ?? globalThis.EventSource;
			return new Source(`${config.baseUrl}/v1${path}`, {
				withCredentials: config.credentials === "include",
			});
		},
	};
}
