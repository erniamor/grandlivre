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
| `ANTHROPIC_API_KEY` | no | Key of the Claude API, which turns notes and receipt photos into draft transactions (`POST …/transactions/draft`, `…/draft/receipt`). Without it, those routes answer 503 `assistant_unavailable` and members enter by hand |
| `RECURRING_RUN_EVERY_SECONDS` | no | How often the recurring transactions whose day has come are recorded or set aside (900, every 15 minutes, by default; at least 5). Lower it in development to try them |
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
| `POST /v1/households` `{ name, currency, timeZone? }` | signed-in user | Creates a household owned by the user (201). `timeZone` is an IANA name (`America/Toronto` when missing; the front end sends the browser's), where the household's days start and end for its recurring transactions; an unknown one answers 422 `household_time_zone_invalid` |
| `GET /v1/households` | signed-in user | Lists the user's households, with their role in each |
| `GET /v1/households/:householdId` | member | The household |
| `PATCH /v1/households/:householdId` `{ name?, currency?, timeZone?, expenseSharing? }` | owner | Changes the fields sent. `expenseSharing` turns on settling shared expenses (off by default) |
| `GET /v1/households/:householdId/members` | member | Lists the members, in the order they joined |
| `PATCH /v1/households/:householdId/members/:userId` `{ role }` | owner | Changes a member's role (204) |
| `DELETE /v1/households/:householdId/members/:userId` | owner, or the member themselves | Removes the member, or leaves the household (204) |

A household always keeps at least one owner: demoting or removing the last one is refused with a 409 `last_owner`.

### Accounts

The financial accounts of a household (chequing, savings, credit card, cash, loan, other). Amounts are integers in minor units of the household's currency (cents); a balance is negative for money owed. The balance is computed, never stored: the opening balance, plus the incomes and the transfers received, minus the expenses and the transfers sent.

Every member sees every account of the household. A member who doesn't hold an account whose `visibility` is `balance` sees its balance but not its details (`openingBalance` is `null`).

| Route | Who | Effect |
| --- | --- | --- |
| `GET /v1/households/:householdId/accounts` | member | Lists the household's accounts, oldest first, with their holders and `isHolder` for the signed-in user |
| `POST /v1/households/:householdId/accounts` `{ name, type, visibility, openingBalance, holderIds? }` | member | Creates an account (201). Its holders are members of the household and include the creator; without `holderIds`, the creator alone |
| `GET /v1/households/:householdId/accounts/summary` | member | The consolidated view: `{ assets, liabilities, balance }` over every account, whoever holds it and whatever its visibility |
| `GET /v1/households/:householdId/accounts/:accountId` | member | The account |
| `PATCH /v1/households/:householdId/accounts/:accountId` | holder | Changes the fields sent; `holderIds` replaces the holders (at least one); `archived` puts the account aside or brings it back |
| `DELETE /v1/households/:householdId/accounts/:accountId` | holder | Deletes an account without transactions (204); otherwise 409 `account_has_transactions`: archive it instead |

A member who leaves the household stops holding its accounts. An account left without a holder stays in the household and still counts; an owner of the household can then change it (to give it a holder) or delete it.

An archived account (`archived: true`) keeps its transactions and still counts in the consolidated view, but takes no new transaction, and its transactions can no longer be changed or deleted (409 `account_archived`).

Once a household has an account, its currency can't change: `PATCH /v1/households/:householdId` with another `currency` answers 409 `currency_locked`.

### Tags

The categories of a household's transactions: a tree (a tag has at most one parent), shared and managed by all the members. A tag has a name per language (`names: { en?, fr?, es? }`, at least one), since members can use different languages; under a same parent (or at the root), a name designates a single tag in a given language, whatever its case. The same name can exist under different parents ("Car › Insurance", "Home › Insurance"): they are distinct tags. A household has at most 500 tags.

| Route | Who | Effect |
| --- | --- | --- |
| `GET /v1/households/:householdId/tags` | member | Lists the household's tags, oldest first, each with its `parentId` (the whole tree fits in one page) |
| `POST /v1/households/:householdId/tags` `{ names, parentId? }` | member | Creates a tag (201), at the root without `parentId` |
| `GET /v1/households/:householdId/tags/suggested` | member | The tags the product suggests to a household starting out: `{ tags }`, a tree where each tag has its `key` (the path leading to it, e.g. `transport/car/gas`), its `names` in every language and its `children` |
| `POST /v1/households/:householdId/tags/suggested` `{ keys }` | member | Adds the suggestions chosen, with the ones above them: a tag comes with its parents (204). A suggestion whose name a tag already has at the same place isn't added again (its children go under that tag), so it adds nothing twice. An unknown key answers 422 with `suggested_tags_invalid` on `keys`, and adds nothing |
| `PATCH /v1/households/:householdId/tags/:tagId` `{ names?, parentId? }` | member | `names` replaces every name of the tag; `parentId` moves it with its child tags (`null`: to the root) |
| `DELETE /v1/households/:householdId/tags/:tagId` | member | Deletes a tag without child tags, transactions nor recurring transactions recording on it (204); otherwise 409 `tag_has_children` or `tag_in_use` |

A name a sibling already has, when creating, renaming or moving a tag, answers 422 with `tag_name_taken` on `names.<locale>`; a parent from outside the household, or the tag itself or one of its descendants, answers 422 with `tag_parent_invalid` on `parentId`.

### Transactions

Money entering an account (`income`), leaving it (`expense`) or moving to another account of the household (`transfer`, neither an income nor an expense). Amounts are positive integers in minor units; the type says which way the money goes. The `date` is a calendar day (`2026-11-14`).

An expense or an income is split into `lines`, each with an `amount` and at most one `tagId` (none: uncategorized). Its `amount` is the sum of its lines and is never sent. A transfer has an `amount`, a `toAccountId`, and no lines.

| Route | Who | Effect |
| --- | --- | --- |
| `GET /v1/households/:householdId/transactions` | member | Lists the transactions the user may see, the most recent day first. Filters: `accountId` (transfers received included), `tagId` (the tags under it included), `type`, `from` and `to` (days, included) |
| `POST /v1/households/:householdId/transactions` | holder of `accountId` | Records a transaction (201). `origin` (`manual` by default, `voice`, `receipt`, `import`; `recurring` is the API's own) and `externalId` say where it comes from; the same `externalId` is never recorded twice on an account (409 `transaction_already_imported`) |
| `GET /v1/households/:householdId/transactions/:transactionId` | member who may see it | The transaction, with its lines and who recorded it |
| `PUT /v1/households/:householdId/transactions/:transactionId` | holder of its account | Replaces the transaction with the one sent, of any type and on any account the user holds; where it comes from is kept |
| `DELETE /v1/households/:householdId/transactions/:transactionId` | holder of its account | Deletes the transaction (204) |

Who writes: the holders of `accountId`, the account the money leaves (expense, transfer) or enters (income), whoever recorded the transaction. A transfer's destination can be any account of the household.

Who sees: the holders of an account, and every member when the account's `visibility` is `details`. The transactions of a `balance` account are hidden from the members who don't hold it (404, and absent from the list), but still count in the balances. A transfer shows to those who see the details of either of its accounts.

An account or a tag from outside the household answers 422 (`transaction_account_invalid` on `accountId` or `toAccountId`, `transaction_tag_invalid` on `lines.<n>.tagId`).

### Drafts (quick entry)

`POST /v1/households/:householdId/transactions/draft` `{ text, today }` (members) turns a note typed or dictated by the member ("gas 72 $", "restaurant 85.40 yesterday") into a draft transaction, with the Claude API. Nothing is saved and no tag is created: the front end shows the draft in the transaction form, and the member records it, or not, through the routes above. `today` is the member's day, to read "yesterday".

The draft: `{ type, date, accountId, toAccountId, payee, note, lines: [{ amount, tagId, usesProposedTag }], proposedTag, remark, receipt, warnings }` (`receipt` is `null` and `warnings` empty for a note). What the assistant couldn't tell is `null`. Only accounts the member may record on (and, for a transfer, any other account of the household) and tags of the household come back; anything else is dropped. `remark` is a word from the assistant in the member's language when something is uncertain.

When no tag fits, the assistant may propose one: `proposedTag: { names: { en, fr, es }, parentId, similarTags: [{ tagId, reason }] }`, with the lines on it marked `usesProposedTag`. It is never created here. `similarTags` lists the household's tags that look like it, in any language (`same_name`: the same name but for case, accents and plural; `similar_name`: a typo away; `contains`: one name holds the other), the closest first. A proposal of the same name as an existing tag under the same parent is replaced by that tag.

What the Claude API receives: the note, the member's day, the household's currency, the member's language, the accounts (marked when the member may record on them), the tags with their paths, and the recent payees with their usual tag, from the accounts whose details the member may see. The note is data: the assistant is told never to follow instructions it holds.

- 60 notes per hour and per member, counted by each instance of the API: beyond, 429 `too_many_requests`.
- 422 `draft_not_understood`: no amount could be read, or every model declined the note.
- 503 `assistant_unavailable`: no `ANTHROPIC_API_KEY`, or the Claude API failed or gave an unusable answer (logged without the note).
- Model: `claude-opus-5-5` at low effort, the household's context cached between notes, and a server-side fallback to another model when one declines a note.

#### Receipts

`POST /v1/households/:householdId/transactions/draft/receipt` (members), a multipart form with `photo` (a JPEG, PNG, WebP or GIF image, up to 5 MB, `RECEIPT_PHOTO_MAX_BYTES`) and `today`, turns the photo of a receipt into a draft expense. The photo is sent to the Claude API, then dropped: never stored, never logged. The same context as for a note goes with it.

- The items are grouped by tag, one line per tag. An item the assistant can tell gets the closest tag, a broader one if need be, or the proposed tag when none fits even loosely; only an item it can't tell stays uncategorized. On a restaurant bill, everything consumed there goes to the tag for eating out.
- The taxes go to the items the receipt marks as taxed (a code such as "FP" or "T" beside the price), in proportion to their amounts: groceries left untaxed in Quebec carry none. When the receipt marks no item, or its figures don't add up, the taxes are shared out over every item instead. Either way, the lines add up to the total paid exactly. A discount lowers its tag.
- `receipt: { merchant, items: [{ name, amount }], subtotal, taxes: [{ name, amount }], total }` keeps what was read (amounts in minor units, a discount negative); send it back with the transaction (`origin: "receipt"`, `receipt`, on an expense or an income) to keep it. It stays when the transaction changes.
- `warnings`: `receipt_total_mismatch` when the items and taxes don't add up to the total (the subtotal isn't checked: a bottle deposit, say, can be left out of it): the lines follow the total, the member should check them.
- 30 receipts per hour and per member, apart from the notes: beyond, 429 `too_many_requests`.
- 422 `validation_error` on `photo`: `receipt_photo_required`, or `receipt_photo_invalid` when the file isn't one of those images, told by its first bytes; 413 `payload_too_large` over 5 MB. Every other route keeps the 1 MB limit.
- 422 `draft_not_understood`: no total could be read (not a receipt, unreadable), or every model declined the photo.

### Reports

What the household earns and spends over a period, from the lines of its expenses and incomes; transfers are neither. Amounts are positive integers in minor units, expenses and incomes apart: how to show them (a refund lowering an expense, the totals of a parent tag) is up to the front ends.

| Route | Who | Effect |
| --- | --- | --- |
| `GET /v1/households/:householdId/reports/tags?from&to&accountId?` | member | `{ from, to, tags: [{ tagId, expense, income }] }`: each tag that had a line in the period, with its own amounts (the tags under it aren't added), and `tagId: null` for the uncategorized lines |
| `GET /v1/households/:householdId/reports/monthly?from&to&tagId?&accountId?` | member | `{ months: [{ month, expense, income, tags }] }`: every month the period touches (`"2026-11"`), empty ones included, with its amounts tag by tag in `tags` as in the report by tag; with `tagId`, only the lines on that tag or on a tag under it. At most 60 months |

`from` and `to` are days, both included. The reports count every account of the household, those that only show their balance included. `accountId` narrows a report to one account, if the user may see its details: otherwise 403, since the report would show, tag by tag, what the account hides.

An invalid period answers 422: `report_period_invalid` on `to` when it comes before `from`, `report_period_too_long` on `from` beyond 60 months. An account or a tag outside the household answers 422 (`transaction_account_invalid`, `transaction_tag_invalid`).

### Recurring transactions

A transaction that repeats: a rent, a subscription, a pay. It holds what it records (`transaction`: a transaction without its `date`, checked like one) and when (`schedule`): from `startDate`, its first day, every `interval` (1 to 99) `unit`s (`week`, `month`, `year`), until `endDate` included, or forever when `null`. A monthly day past the end of a shorter month falls on its last day (the 31st on April 30th, on February 28th or 29th) and is back on the 31st the month after.

`mode`: `automatic`, recorded on its own when its day comes (a fixed amount), or `confirm` (default), which waits for a member to confirm it, its amount open to change. `nextDate` is its next day not yet recorded or waiting; `null` once it has ended.

| Route | Who | Effect |
| --- | --- | --- |
| `GET /v1/households/:householdId/recurring-transactions` | member | Lists the recurring transactions the user may see, the next due first, the ended ones last |
| `POST /v1/households/:householdId/recurring-transactions` `{ transaction, schedule, mode? }` | holder of `transaction.accountId` | Creates one (201) |
| `GET /v1/households/:householdId/recurring-transactions/:recurringId` | member who may see it | The recurring transaction |
| `PUT /v1/households/:householdId/recurring-transactions/:recurringId` | holder of its account | Replaces it with the one sent. The transactions it already recorded stay as they are. An unchanged schedule keeps its next day; a new one (`unit`, `interval` or `startDate`) starts on its first day |
| `DELETE /v1/households/:householdId/recurring-transactions/:recurringId` | holder of its account | Deletes it (204); the transactions it recorded stay |

- Who sees and writes: as for transactions, from its account (and, for a transfer, its destination). An archived account takes none (409 `account_archived`). A tag it records on can't be deleted (409 `tag_in_use`); deleting its account (one without transactions) deletes it.
#### Their days

The API records them itself: on start, then every `RECURRING_RUN_EVERY_SECONDS`, a run (`runDueRecurrences()`) takes each recurring transaction whose `nextDate` has come in its household's time zone, and handles every day due up to today, so the days missed while the API was down are caught up.

- `automatic`: the transaction is recorded on that day, with the origin `recurring`, on behalf of whoever created the recurring transaction. When its account is archived (or its destination, for a transfer), or has no holder left, the day waits for a member instead.
- `confirm`: the day waits for a member, who records it as reviewed (its amount, its day, its account can change) or skips it.
- Each day handled is kept (`recurring_occurrences`, unique per recurring transaction and day): a day is never recorded twice, whatever runs at the same time on several instances of the API (each recurring transaction is locked while it is handled, `SKIP LOCKED`). A recurring transaction that fails is logged by its id only and tried again on the next run.

| Route | Who | Effect |
| --- | --- | --- |
| `GET /v1/households/:householdId/recurring-transactions/pending` | member | The days waiting for a member, the oldest first: `{ id, date, recurring }`, `recurring` as it is now |
| `POST /v1/households/:householdId/recurring-transactions/pending/:occurrenceId/confirm` | holder of the transaction's account | Records the transaction sent (the body of `PUT …/transactions/:id`), with the origin `recurring` (201) |
| `POST /v1/households/:householdId/recurring-transactions/pending/:occurrenceId/skip` | holder of its account | Records nothing for that day, for good (204) |
| `GET /v1/households/:householdId/recurring-transactions/upcoming?days=30` | member | The days to come, from the next day of each recurring transaction to `days` (1 to 90) after today: `{ date, recurring }`, the soonest first |

A day already recorded or skipped answers 409 `occurrence_already_handled`.

- A first day before today, in the household's time zone, answers 422 `recurrence_start_in_past` on `schedule.startDate`: what already happened is entered by hand. Other codes: `recurrence_unit_invalid`, `recurrence_interval_invalid`, `recurrence_mode_invalid`, `recurrence_end_before_start` (on `schedule.endDate`). The errors about what it records point into it: `transaction.accountId`, `transaction.lines.<n>.tagId`.

### Budgets

What a household means to spend on a tag, and where it stands. A budget on a tag covers the tags under it. It is `month`ly or `year`ly, and set from a month on (`from`, "2026-11"): that month and the following ones take it, the months before keep theirs. Shared and managed by every member, like the tags. Amounts are positive integers in minor units, for the whole period.

| Route | Who | Effect |
| --- | --- | --- |
| `GET /v1/households/:householdId/budgets?month=2026-11` | member | The budgets in force that month (the household's current month, in its time zone, by default), monthly ones first: `{ month, budgets: [{ tagId, period, amount, since, spent, upcoming }] }` |
| `PUT /v1/households/:householdId/budgets/:tagId` `{ period, amount, from }` | member | Sets the budget of the tag from `from` on, replacing any later change (200) |
| `DELETE /v1/households/:householdId/budgets/:tagId?from=2027-01` | member | Stops it from that month on; the months before keep it (204) |
| `GET /v1/households/:householdId/budgets/:tagId/suggestion?month=2026-11` | member | What the tag usually costs before the month: `{ month }`, the average of the 3 previous months, and `{ year }`, the sum of the 12 previous ones |

- `spent`: the expenses on the tag and the tags under it over the period (the month; for a yearly budget, its calendar year up to the end of the month, as it stood then), refunds (incomes on them) taken off, never below zero. Transfers and uncategorized lines don't count. Every account counts, including the ones that only show their balance, as in the reports: only totals come out.
- `upcoming`: what the recurring expenses still plan in the period (until the end of the year for a yearly budget), from today on, and their days waiting for a member; nothing for a month past.
- A tag from outside the household answers 404. Codes: `budget_period_invalid`, `budget_month_invalid`, `amount_not_positive`. Deleting a tag (possible only without transactions) deletes its budgets.

### Expense sharing

Optional, for the households that settle between members: off by default (`expenseSharing` on the household, set by an owner). While it is off, sharing a transaction answers 409 `sharing_disabled`, and so does every route below; the data already there stays.

A transaction (an expense, or an income: a refund) paid from an account with **one** holder can be shared among members: `shares` on `POST` and `PUT …/transactions`, one of `{ mode: "equal", userIds }`, `{ mode: "weights", parts: [{ userId, weight }] }`, `{ mode: "amounts", parts: [{ userId, amount }] }`. Parts are rounded to the cent and add up to the amount. On `PUT`, `shares` missing keeps the split (its parts follow the new amount), `null` stops it. The transaction then carries `sharing: { paidBy, split, parts }`; `paidBy` is its account's holder when it was shared. A joint account holds money already shared: 422 `share_account_not_personal`. Other codes, on `shares`: `share_member_invalid`, `share_members_invalid`, `share_amounts_mismatch`, `share_weight_invalid`.

| Route | Who | Effect |
| --- | --- | --- |
| `GET /v1/households/:householdId/sharing` | member | `{ weights, balances, suggestions }`: the default split (a weight per member, 1 when never set); each one's balance, positive when the others owe them, with anyone who left with a balance (`isMember: false`); the fewest payments that settle everything |
| `PUT /v1/households/:householdId/sharing/weights` `{ weights: [{ userId, weight }] }` | owner | Sets the default split, which the front ends start from |
| `GET /v1/households/:householdId/sharing/expenses` | member | The shared transactions the user is concerned by, the most recent first: the ones they paid, have a part in, or whose account's details they see. A member with a part sees it here even on an account that only shows its balance, and nothing else of that account |
| `GET /v1/households/:householdId/sharing/settlements` | member | The settlements, the most recent first |
| `POST /v1/households/:householdId/sharing/settlements` `{ fromUserId, toUserId, amount, date, note?, transfer? }` | the one who pays, or is paid | Records a payment between two members (201). With `transfer: { fromAccountId, toAccountId }`, also records it as a transfer from an account the payer holds to one the other holds (422 `settlement_account_invalid` otherwise), by a holder of the first |
| `DELETE /v1/households/:householdId/sharing/settlements/:settlementId` | the one who paid, or was paid | Deletes it (204), with its transfer, which only its account's holders can delete; deleting the transfer deletes the settlement too |

### Events (real time)

`GET /v1/households/:householdId/events` (members only) is a stream of [Server-Sent Events](https://developer.mozilla.org/docs/Web/API/Server-sent_events): open it with the browser's `EventSource`, with the session cookie. Each message tells what changed in the household and carries no data:

```
data: {"topic":"transactions"}
```

Topics: `household` (name, currency, time zone), `members`, `invitations`, `accounts`, `tags`, `transactions` (and so the balances), `recurring`, `budgets`, `sharing` (default split and settlements; a shared transaction's changes come as `transactions`). On each one, the front end reloads, through the routes above, what it shows of that topic: the rules on who sees what stay in one place. The author of a change gets its event too.

- An event is sent only once the change is saved: a refused change sends nothing.
- The stream starts with a `ready` event (`event: ready`), sent once events are listened to: reload the data then, not on `EventSource`'s `open`, which comes a moment earlier. A `: ping` comment follows every 25 seconds so proxies keep the stream open.
- A member who leaves the household, or is removed from it, has their stream closed.
- Events travel through PostgreSQL (`LISTEN`/`NOTIFY` on the `household_events` channel), so they reach the members connected to any instance of the API.
- What was missed while disconnected isn't replayed: on reconnection, the front end reloads everything.

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
| 403 | `forbidden` | A cross-site form was rejected (CSRF), or the action takes an owner of the household or a holder of the account (its own changes, its transactions) |
| 404 | `not_found` | Unknown route or resource, or a household the user isn't a member of |
| 409 | `last_owner` | The change would leave a household without an owner |
| 409 | `tag_has_children` | The tag has child tags: it can't be deleted |
| 409 | `tag_in_use` | The tag has transactions: it can't be deleted |
| 409 | `account_has_transactions` | The account has transactions: it can't be deleted, only archived |
| 409 | `account_archived` | The account is archived: it takes no new transaction and its transactions can't change |
| 409 | `transaction_already_imported` | A transaction with this `externalId` is already on the account |
| 409 | `tag_limit_reached` | The household already has its maximum number of tags |
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
