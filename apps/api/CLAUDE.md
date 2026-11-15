# CLAUDE.md : apps/api

> Complements the root `CLAUDE.md`, which also applies here, except for what is specific to TanStack Start, React and shadcn components: this app is a Hono web server, with no UI. Contains only the rules specific to this API.

## Role

The product's backend. Exposes a JSON REST API consumed by `apps/www` through `@repo/resources`. Out of the box it manages accounts, passwordless sign-in and the user's profile, and calls an email provider (sign-in links and codes). The product's own domains are added as route modules.

## App-specific stack

- Hono 4.x on Node 24, served by `@hono/node-server`
- Database: PostgreSQL 17, accessed through Drizzle ORM with the `postgres` (postgres.js) driver; snake_case column names (`casing: "snake_case"`); versioned SQL migrations with `drizzle-kit`
- Validation: Zod, through Hono's validator middleware (`@hono/zod-validator`)
- Authentication: Better Auth, sessions in an HTTP-only cookie; passwordless email (magic link, one-time code) and Google (see "Authentication")
- Dev: `tsx watch`; build: tsdown bundle to `dist/index.mjs` (and `dist/db/migrate.mjs`, run before each deployment), which also compiles the internal `@repo/*` packages consumed as TypeScript source
- TypeScript: extends `@repo/config-ts/node.json` (Node code without DOM)
- Tests: Vitest, with Hono's `app.request()` for routes, against the Docker test database

## Local database

`docker-compose.yml` starts PostgreSQL on host port **5434** (5432 is often taken by other projects), with two databases: `grandlivre` (development) and `grandlivre_test` (tests, created by `docker/postgres/init.sql` when the volume is first created). Docker must be running for the dev server and the tests.

## Commands

- Start / stop the local database: `pnpm --filter api db:up`, `pnpm --filter api db:down`
- Dev: `pnpm --filter api dev` (reads `.env`; copy `.env.example` first)
- Build: `pnpm --filter api build`
- Production start: `pnpm --filter api start`
- Generate a migration: `pnpm --filter api db:generate`
- Apply migrations: `pnpm --filter api db:migrate`
- Tests: `pnpm --filter api test` (applies the migrations to `grandlivre_test` first)
- Typecheck: `pnpm --filter api typecheck`

## Structure

- `src/index.ts`: entry point; starts the Node server with the app built in `app.ts`
- `src/app.ts`: builds the Hono app (global middlewares, mounting of route modules, error handler), with no side effect, so tests can import it
- `src/env.ts`: environment variables validated with Zod at startup; the only place that reads `process.env`
- `src/routes/<domain>/`: one folder per domain (`health`, `me`, `households`, `invitations`, `accounts`, `tags`, `transactions`, `drafts`, `recurring`, `events`, `reports`...)
  - `<domain>.routes.ts`: the domain's Hono sub-app (routes, validators, call to the service)
  - `<domain>.service.ts`: business logic, independent of Hono
  - `<domain>.schemas.ts`: Zod schemas used only by this API (shared ones are in `@repo/schemas`)
  - `<domain>.test.ts`: tests
- `src/middlewares/`: cross-cutting middlewares (`require-auth.ts`; `require-household.ts`: `requireHouseholdMember` loads the household of `:householdId` for its members and answers 404 to anyone else, `requireHouseholdOwner` restricts a route to owners)
- `src/db/`: Drizzle client (`client.ts`), schema (`schema/<table>.ts`, re-exported by `schema/index.ts`) and migration script (`migrate.ts`)
- `src/lib/`: utilities specific to the app (`auth.ts`: Better Auth instance; `errors.ts`: `AppError` and the error body; `error-handler.ts`: global error and not-found handlers; `mailer.ts`: email sending; `locale.ts`: locale resolution from `Accept-Language`; `validator.ts`: `validate()`, the `zValidator` answering 422 in the API's error format; `pagination.ts`: pagination query schema and offset; `assistant.ts`: the Claude API client that turns notes and receipt photos into drafts (`assistant`, replaced in tests with `vi.spyOn(assistant, "draftTransaction")` or `vi.spyOn(assistant, "readReceipt")`); `rate-limit.ts`: an in-memory sliding-window limiter; `dates.ts`: `todayIn()`, today in a household's time zone; `events.ts`: `publishHouseholdEvent()` and `subscribeToHousehold()`, the real-time events of a household, through PostgreSQL)
- `src/emails/`: email contents, in every supported locale
- `src/routes/recurring/recurring-runner.ts`: `runDueRecurrences()`, which records the recurring transactions whose day has come (or sets them aside for a member), and `startRecurringTimer()`, started by `src/index.ts` (never by `app.ts`: tests call `runDueRecurrences(now)` themselves, with a fake clock)
- `src/routes/recurring/schedule.ts`: the days of a recurring transaction's schedule (`occurrenceAt()`, `nextOccurrence()`, `occurrencesBetween()`), pure functions on calendar days; a schedule's days are counted from its first day, so a monthly 31st comes back after a shorter month
- `src/routes/tags/suggested-tags.ts`: the tags suggested to a household starting out, named in every language; add one with `tag(en, fr, es, [children])`, its key is derived from its English names (`suggested-tags.test.ts` checks the list)
- `test/`: Vitest global setup (checks the test database and applies the migrations), database reset before each test, and helpers (`helpers/auth.ts`: `signIn()`, `captureEmails()`; `helpers/api.ts`: `api()`, `json()`; `helpers/households.ts`: `signInUser()`, `createTestHousehold()`, `addTestMember()`; `helpers/transactions.ts`: `householdApi()`, shortcuts to the accounts, tags and transactions of a household; `helpers/events.ts`: `openEvents()`, reads a household's event stream), imported through the `@test/` alias
- `drizzle/`: generated SQL migrations, committed, never edited after they have been applied
- `docker-compose.yml`, `docker/`: local PostgreSQL

## Authentication

- Better Auth is mounted on `/v1/auth/*` and configured in `src/lib/auth.ts`. Password sign-in stays disabled; Google is enabled only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.
- Its tables (`users`, `sessions`, `accounts`, `verifications`) are written by hand in `src/db/schema/` (plural names, `usePlural: true`, uuid ids). `auth.schema.test.ts` checks them against what Better Auth expects: after a Better Auth upgrade or a new plugin, run the tests and add the missing fields with a migration.
- Protect a route with the `requireAuth` middleware, then read `c.get("user")`; never trust a user identifier sent by the client.
- In production, `COOKIE_DOMAIN` shares the session cookie with the front end's subdomain (`crossSubDomainCookies`), so its server-side rendering sees the session.
- Keep `advanced.disableOriginCheck: false`: Better Auth otherwise skips its callback URL and origin checks when `NODE_ENV` is `test`.
- Emails go through `mailer`: sent with Resend when `RESEND_API_KEY` and `EMAIL_FROM` are set (always in production, the environment requires them), printed to the console otherwise. Their locale comes from the request's `Accept-Language` header.
- A failed sending is logged without the email's content (it holds sign-in links and codes) and answered with a 503 `email_unavailable`. Tests never call Resend: `captureEmails()` replaces `mailer.send`.

## Routes and handlers

- Each domain is a Hono sub-app mounted in `app.ts` with `app.route("/<domain>", ...)`. Prefix the API with a version (`/v1`).
- Handlers stay thin: read the validated input, call a service, return the response. Business logic lives in services, which know nothing about Hono (no `Context` passed to services).
- Validate every input (`param`, `query`, `json`, `form`, `header`) with `validate()` (from `src/lib/validator.ts`, a `zValidator` that answers 422 in the API's error format) and a Zod schema before use; read it with `c.req.valid(...)`, never with `c.req.json()` directly.
- Follow REST conventions: plural resource names, appropriate HTTP methods and status codes (`201` on creation, `204` with no content, `404`, `409`, `422`).
- Consistent response shapes: a resource or a `{ data, pagination }` list; errors in a single format `{ error: { code, message, details? } }`, produced by the global error handler (`app.onError`) from `HTTPException` or typed errors.
- Paginate every list, with a maximum page size enforced by the server.
- Never return sensitive fields (password hashes, tokens, private data): responses are built explicitly, not by returning the database row.

## Real time

- Every service that changes a household's data publishes the matching event with `publishHouseholdEvent(tx, householdId, topic)`, inside the same transaction as the change, after it: PostgreSQL delivers it on commit, never on rollback. A new kind of change publishes its event too, and the events test checks its topic.
- An event names a topic (`HOUSEHOLD_EVENT_TOPICS` in `@repo/schemas`) and carries no data: the clients reload through the REST routes, which apply who may see what. Never put data in an event.

## Claude API

- Only `src/lib/assistant.ts` talks to the Claude API, through the official SDK (`@anthropic-ai/sdk`); its key comes from `env.ANTHROPIC_API_KEY`, never from `process.env` elsewhere.
- Tests never call the Claude API: they replace `assistant.draftTransaction` or `assistant.readReceipt` with a spy, or build `createClaudeAssistant()` on a fake client.
- A receipt photo (`POST …/transactions/draft/receipt`, a multipart form, up to `RECEIPT_PHOTO_MAX_BYTES`: the only route exempt from the global 1 MB body limit) is checked by its first bytes (`receipt-photo.ts`), sent to the Claude API, then dropped: never stored, never logged. Its items are grouped by tag and the taxes shared out over the taxed items, or over every item when the receipt doesn't mark them (`receipt-lines.ts`), so the lines always add up to the total paid; the receipt's details are kept with the transaction (`receipt` column).
- What the assistant answers is data to check, like any outside input: references, amounts and dates are validated against the household before anything leaves the API; a member's note is never treated as instructions.
- Send the Claude API only what the member may see: no data of an account that hides its transactions from them.
- Keep the stable part of a request first (system prompt, then the household's context, cached) and the volatile part last (the note, the day), so the cache holds.

## Data and migrations

- The Drizzle schema in `src/db/schema/` is the source of truth for the database structure; types are derived from it (`InferSelectModel`, `InferInsertModel`), never written by hand.
- Every structural change goes through a migration generated by `drizzle-kit generate`, reviewed and committed. Never `drizzle-kit push` outside a local database.
- Data access only goes through Drizzle and the services; raw SQL (`sql`) only where clearly necessary and commented, always with parameters, never string concatenation.
- Use transactions for operations that write to several tables.
- Never delete, empty or reset a database, nor run a migration or a data import on production unless I explicitly ask for it.
- Required base data (roles, reference data) is created by an idempotent seed script, not by hand in an environment.

## Contract with the front ends

- The API's routes and responses form a contract with the apps that consume them through `@repo/resources`: renaming, removing or making a field required can break the front ends.
- Before modifying an existing route or response, search for its usages in `apps/` and `packages/` and update `resources` and the consuming apps in the same change.
- Prefer adding an optional field or a new route over modifying an existing one; a breaking change goes through a new API version.
- Schemas shared with the front ends (form inputs, responses) come from `@repo/schemas` and are never redefined here; responses are built to match their response schema. This app imports nothing from `packages/resources`: it is the API's client, not the other way around.

## Security

- Secrets (database URL, signing keys, third-party API keys) only in environment variables, validated in `src/env.ts`, never in the repository. Provide a `.env.example` without real values.
- Authentication and authorization are checked here, on every protected route, through middlewares; never assume the front end has checked them.
- Configure CORS (`hono/cors`) with the list of allowed origins, never `*` in production; add the security headers (`hono/secure-headers`).
- Cookies: `HttpOnly`, `Secure`, `SameSite`; protect cookie-authenticated mutations against CSRF (`hono/csrf`).
- Limit the request body size and rate-limit sensitive routes (authentication, forms).
- Never log a password, token or personal data; error responses never expose a stack trace or SQL error in production.

## Tests

- Test services and pure logic first.
- Test routes through `app.request()` on the app built in `app.ts`, without starting a server: status codes, response shapes, validation errors.
- Database tests run on a dedicated test database (or a disposable container), reset between tests, never against a development or production database.
- Explicitly test permission cases: an unauthenticated or unauthorized user must not be able to access the route.

## Never do

- Read `process.env` outside `src/env.ts`, or commit an `.env`, a key or a database dump.
- Put business logic in a handler, or pass Hono's `Context` to a service.
- Use an unvalidated input, or return a database row as-is.
- Edit a migration that has already been applied, or use `drizzle-kit push` on a shared database.
- Open CORS to `*` in production, or disable authentication on a route without an explicit request.
- Import code from another app, or use React, TanStack Start or shadcn in this app.
- Modify a route's contract without checking and updating its consumers.
