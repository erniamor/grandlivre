# @repo/resources

Typed client of the API (`apps/api`) for the front ends. Each resource groups the operations of one domain; inputs are validated with [`@repo/schemas`](../schemas) before sending, responses are validated against their schema, and failures come back as typed errors.

## Usage

```ts
import { createApi, UnauthorizedError, ValidationError } from "@repo/resources";

const api = createApi({
	baseUrl: "http://localhost:3001", // without /v1
	credentials: "include", // in the browser: sends the session cookie
	headers: () => ({ "Accept-Language": "fr" }), // read at every request
});

try {
	const me = await api.me.get();
} catch (error) {
	if (error instanceof UnauthorizedError) {
		// not signed in
	}
}
```

During server rendering, pass the incoming request's cookie in `headers` instead of `credentials` (see `apps/www/src/lib/api.ts`).

## Resources

| Resource | Operations |
| --- | --- |
| `auth` | `sendMagicLink({ email, callbackURL })`, `sendSignInCode({ email })`, `signInWithCode({ email, code })`, `signOut()` |
| `me` | `get()`, `update({ name })` |

Add a resource per domain of the API: a `src/<resource>/<resource>.resource.ts` exporting `create<Resource>Resource(client)`, registered in `createApi()` (`src/index.ts`).

`src/api/page.ts` holds the helpers for paginated operations: they return a `Page<T>` (`{ items, page, pageSize, total }`, built by `toPage()` from the API's `{ data, pagination }` envelope), build their query string with `withQuery()`, and encode identifiers in the path with `segment()`, so they can't change the requested route.

## Errors

| Class | When | Useful fields |
| --- | --- | --- |
| `ValidationError` | Invalid input, caught before sending or answered by the API (400, 422) | `code`, `issues: [{ field, message }]` with error codes from `@repo/schemas` |
| `UnauthorizedError` | 401, no valid session | `code` |
| `ForbiddenError` | 403 | `code` |
| `NotFoundError` | 404 | `code` |
| `RateLimitError` | 429 | `code` |
| `ServerError` | 5xx, or a response that doesn't match its schema (`code: "unexpected_response"`) | `code` |
| `ApiError` | Any other error status (e.g. 409, 410); parent class of all the above | `status`, `code`, `message` |
| `NetworkError` | The API couldn't be reached | `cause` |

Errors of the sign-in routes (handled by Better Auth) are read the same way, with their codes lowercased: a wrong code is a `ValidationError` with the code `invalid_otp`. A cancelled request (`AbortSignal`) rejects with the original `AbortError`.

## Scripts

`pnpm --filter @repo/resources test`, `pnpm --filter @repo/resources typecheck`.
