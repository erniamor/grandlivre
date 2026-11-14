import { WEB_ORIGIN } from "@test/helpers/auth";
import { app } from "@/app";

interface ApiRequest {
	method?: string;
	cookie?: string;
	body?: unknown;
	headers?: Record<string, string>;
}

/** Calls the API as the browser front end would, with an optional session cookie. */
export function api(
	path: string,
	{ method = "GET", cookie, body, headers: extraHeaders }: ApiRequest = {},
) {
	const headers: Record<string, string> = {
		Origin: WEB_ORIGIN,
		...extraHeaders,
	};
	if (cookie) {
		headers.Cookie = cookie;
	}
	if (body !== undefined) {
		headers["Content-Type"] = "application/json";
	}
	return app.request(path, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
}

/** Reads a JSON response body with the type the test expects. */
export async function json<T>(response: Response): Promise<T> {
	return (await response.json()) as T;
}
