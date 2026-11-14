# api

Grand Livre's REST API, for now: accounts, passwordless sign-in and the user's profile, ready to receive the product's own routes. Built with Hono on Node 24, Drizzle ORM on PostgreSQL 17 and Better Auth.

## Setup

Docker must be running.

```sh
cp .env.example .env        # then fill in BETTER_AUTH_SECRET
pnpm --filter api db:up      # PostgreSQL on localhost:5434
pnpm --filter api db:migrate
pnpm --filter api dev        # http://localhost:3001
```

The database container holds two databases: `grandlivre` for development and `grandlivre_test` for the tests. It listens on port 5434 to avoid clashing with another local PostgreSQL on 5432.

## Environment variables

Validated at startup by [`src/env.ts`](src/env.ts): the API refuses to start with an invalid value.

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | no | `development` (default), `test` or `production` |
| `PORT` | no | Listening port, `3001` by default |
| `API_URL` | yes | Public URL of the API, used in sign-in links and OAuth callbacks |
| `APP_URL` | yes | Public URL of the front end, used to build the links sent by email |
| `DATABASE_URL` | yes | PostgreSQL connection URL |
| `CORS_ORIGINS` | yes | Comma-separated front-end origins allowed to call the API (with cookies) |
| `BETTER_AUTH_SECRET` | yes | At least 32 characters; signs sessions and tokens |
| `RESEND_API_KEY`, `EMAIL_FROM` | in production | Send the emails with [Resend](https://resend.com); both or none. `EMAIL_FROM` is `Name <address>` or `address`, on a domain verified in Resend. Without them (development, tests), emails are printed to the console |
| `COOKIE_DOMAIN` | in production | Parent domain of the API and the front end (e.g. `grandlivre.example.com` for `api.grandlivre.example.com` and `grandlivre.example.com`): the session cookie is shared with the front end's server. `API_URL` and `APP_URL` must be under it. Unset in development |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | no | Enable Google sign-in; both or none. Redirect URI: `<API_URL>/v1/auth/callback/google` |

## Scripts

| Script | Effect |
| --- | --- |
| `dev` | Development server with reload (`tsx watch`) |
| `build` / `start` | Bundle to `dist/index.mjs` with tsdown / run it |
| `db:up` / `db:down` | Start / stop the local PostgreSQL |
| `db:generate` | Generate a SQL migration from the Drizzle schema (`src/db/schema/`) into `drizzle/` |
| `db:migrate` | Apply the migrations to the database of `.env` |
| `db:migrate:built` | Same, from the build (`dist/db/migrate.mjs`): run before each production deployment, with the service's environment |
| `test` | Run the tests against `grandlivre_test` (migrations applied first) |
| `typecheck` | Check the types |

Run them from the repository root with `pnpm --filter api <script>`.

## API

Every route is prefixed with `/v1`. Responses are JSON; lists come as `{ data, pagination: { page, pageSize, total } }`, paginated with the `page` and `pageSize` query parameters.

### Authentication

Handled by Better Auth under `/v1/auth/*`, with a session in an HTTP-only cookie. Front ends send their requests with `credentials: "include"`.

| Route | Effect |
| --- | --- |
| `POST /v1/auth/email-otp/send-verification-otp` `{ email, type: "sign-in" }` | Emails a 6-digit sign-in code |
| `POST /v1/auth/sign-in/email-otp` `{ email, otp }` | Signs in with the code (creates the account if needed) |
| `POST /v1/auth/sign-in/magic-link` `{ email, callbackURL }` | Emails a sign-in link; opening it signs in and redirects to `callbackURL` (must be one of `CORS_ORIGINS`) |
| `POST /v1/auth/sign-out` | Signs out |
| `GET /v1/me` | Profile of the signed-in user (`name` is empty until they choose one) |
| `PATCH /v1/me` `{ name }` | Sets the user's name (1 to 60 characters) |

Codes and links are valid for 10 minutes. Emails are in English, French or Spanish depending on the request's `Accept-Language` (the front end sends the app's language). Password sign-in is disabled. Errors of the `/v1/auth/*` routes come from Better Auth, as `{ code, message }` with uppercase codes (e.g. `INVALID_OTP`); `@repo/resources` reads them like the API's.

### Households

A household is visible to its members only: anyone else gets a 404, as for a household that doesn't exist. A member is an `owner` or a plain `member`; the creator is an owner.

| Route | Who | Effect |
| --- | --- | --- |
| `POST /v1/households` `{ name, currency }` | signed-in user | Creates a household owned by the user (201) |
| `GET /v1/households` | signed-in user | Lists the user's households, with their role in each |
| `GET /v1/households/:householdId` | member | The household |
| `PATCH /v1/households/:householdId` `{ name?, currency? }` | owner | Changes the fields sent |
| `GET /v1/households/:householdId/members` | member | Lists the members, in the order they joined |
| `PATCH /v1/households/:householdId/members/:userId` `{ role }` | owner | Changes a member's role (204) |
| `DELETE /v1/households/:householdId/members/:userId` | owner, or the member themselves | Removes the member, or leaves the household (204) |

A household always keeps at least one owner: demoting or removing the last one is refused with a 409 `last_owner`.

### Accounts

The financial accounts of a household (chequing, savings, credit card, cash, loan, other). Amounts are integers in minor units of the household's currency (cents); a balance is negative for money owed. The balance is computed, never stored: the opening balance plus the transactions (none yet).

Every member sees every account of the household. A member who doesn't hold an account whose `visibility` is `balance` sees its balance but not its details (`openingBalance` is `null`).

| Route | Who | Effect |
| --- | --- | --- |
| `GET /v1/households/:householdId/accounts` | member | Lists the household's accounts, oldest first, with their holders and `isHolder` for the signed-in user |
| `POST /v1/households/:householdId/accounts` `{ name, type, visibility, openingBalance, holderIds? }` | member | Creates an account (201). Its holders are members of the household and include the creator; without `holderIds`, the creator alone |
| `GET /v1/households/:householdId/accounts/summary` | member | The consolidated view: `{ assets, liabilities, balance }` over every account, whoever holds it and whatever its visibility |
| `GET /v1/households/:householdId/accounts/:accountId` | member | The account |
| `PATCH /v1/households/:householdId/accounts/:accountId` | holder | Changes the fields sent; `holderIds` replaces the holders (at least one) |
| `DELETE /v1/households/:householdId/accounts/:accountId` | holder | Deletes the account (204) |

A member who leaves the household stops holding its accounts. An account left without a holder stays in the household and still counts; an owner of the household can then change it (to give it a holder) or delete it.

Once a household has an account, its currency can't change: `PATCH /v1/households/:householdId` with another `currency` answers 409 `currency_locked`.

### Invitations

An owner invites someone by email. There is no invitation token: the invitation is addressed to an email, and signing in with that email is what proves it is theirs. Invitations are valid for 7 days; accepted, declined and cancelled ones are deleted.

| Route | Who | Effect |
| --- | --- | --- |
| `POST /v1/households/:householdId/invitations` `{ email }` | owner | Invites the email and sends the invitation email, in the language of the request (201). Inviting the same email again renews the invitation and sends the email again. Nothing is saved if the email can't be sent |
| `GET /v1/households/:householdId/invitations` | member | Lists the household's pending invitations |
| `DELETE /v1/households/:householdId/invitations/:invitationId` | owner | Cancels an invitation (204) |
| `GET /v1/invitations` | signed-in user | Lists the pending invitations addressed to the user's email |
| `POST /v1/invitations/:invitationId/accept` | invited user | Joins the household as a plain member and returns it |
| `POST /v1/invitations/:invitationId/decline` | invited user | Deletes the invitation (204) |

An invitation that is expired, or addressed to someone else, answers 404.

### Errors

Every error has the same shape:

```json
{ "error": { "code": "validation_error", "message": "Invalid request", "details": [{ "field": "name", "message": "name_required" }] } }
```

| Status | `code` | When |
| --- | --- | --- |
| 401 | `unauthorized` | No valid session |
| 403 | `forbidden` | A cross-site form was rejected (CSRF), or the action takes an owner of the household or a holder of the account |
| 404 | `not_found` | Unknown route or resource, or a household the user isn't a member of |
| 409 | `last_owner` | The change would leave a household without an owner |
| 409 | `currency_locked` | The household has accounts: its currency can no longer change |
| 409 | `already_member` | The invited email already belongs to a member of the household |
| 413 | `payload_too_large` | Body over 1 MB |
| 422 | `validation_error` | Invalid input; `details` lists each field with an error code from `@repo/schemas` |
| 500 | `internal_error` | Unexpected error, logged on the server, never detailed in the response |
| 503 | `email_unavailable` | Resend refused the email or didn't answer in 10 seconds (the reason is logged on the server) |

## Email sending

Sign-in links and codes are sent with Resend's REST API (`src/lib/mailer.ts`, no SDK), as plain text, in the recipient's language.

1. In Resend, add the sender's domain in the **EU region** (Ireland), then add the DNS records Resend gives (SPF, DKIM). Use a subdomain (e.g. `mail.example.com`) to keep the main domain's reputation separate.
2. Create an API key with "Sending access", restricted to that domain.
3. Set `RESEND_API_KEY` and `EMAIL_FROM` in `.env` (or the host's secrets in production).

Before the domain is verified, `EMAIL_FROM=onboarding@resend.dev` works for trying it out, but only towards the email address of the Resend account. To print the emails again in development, remove both variables.

## Tests

```sh
pnpm --filter api test
```

The tests call the app in memory through `app.request()` and use the `grandlivre_test` database, emptied before each test. Helpers in `test/helpers/` sign a user in (`signIn()`), capture the emails sent (`captureEmails()`), and call the API as the front end would (`api()`, `json()`). `TEST_DATABASE_URL` points the tests to another database (e.g. in CI).

## Production notes

- Deployed on Railway: see [docs/deployment.md](../../docs/deployment.md).

- Emails are sent with Resend, required in production: the API refuses to start without `RESEND_API_KEY` and `EMAIL_FROM`, rather than print sign-in links and codes to the logs. See "Email sending".
- Better Auth's rate limiting is active in production only, kept in memory: enough for a single instance.
- Hosting options: [docs/hosting.md](../../docs/hosting.md).
