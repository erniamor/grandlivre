# Deployment

How to deploy Grand Livre to [Railway](https://railway.com) (Hobby plan), from the `main` branch of its GitHub repository. Why Railway, and the alternatives: [hosting.md](hosting.md).

| Railway service | Content | Public URL |
| --- | --- | --- |
| `www` | Front end: TanStack Start built by Nitro into a Node server | `https://grandlivre.romain.re` |
| `api` | API: Hono on Node | `https://api.grandlivre.romain.re` |
| `Postgres` | PostgreSQL, managed by Railway, on a volume | none (private network only) |

The front end and the API share the parent domain `grandlivre.romain.re`: the session cookie is set for it (`COOKIE_DOMAIN`), so the front end's server receives it and renders signed-in pages. The cookie stays within `grandlivre.romain.re`: nothing else under `romain.re` receives it.

## Before the launch: a pre-launch

The first deployment is a **pre-launch**: until the launch is declared (see [roadmap.md](roadmap.md)), the production database is disposable, reset at will (see "Resetting the database before the launch"), and nobody keeps real data in it. From the launch on, it is never reset again, and migrations must keep the data in place.

## What must stay as it is

- **One instance of each service.** The API keeps in its memory the rate limits (sign-in, notes, receipts, voice, tag suggestions) and the timer that records the recurring transactions whose day has come: a second instance would count apart and record them twice.
- **`BETTER_AUTH_SECRET` never changes once real data is in.** It signs the sessions, and it is the key of the hash that recognizes an account at the bank from its number (`statement_accounts.number_hash`): a new secret signs everyone out, and every statement account then has to be tied to its account again.
- **`VITE_API_URL` is read when `www` is built**: changing it needs a new build, not only a restart.

## Service settings

The services are configured in Railway's dashboard. Railway's config files (`railway.json`) are deprecated and no longer accepted for new services, so the settings are recorded here instead.

Both services deploy the repository root (Root Directory left empty): the pnpm workspace is installed from the root, with Node and pnpm versions read from `engines` and `packageManager` in the root `package.json`.

### `api`

| Setting | Value |
| --- | --- |
| Source | GitHub repository, branch `main`, Root Directory empty |
| Build command | `pnpm --filter api build` |
| Pre-deploy command | `pnpm --filter api db:migrate:built` |
| Start command | `pnpm --filter api start` |
| Healthcheck path | `/v1/health` |
| Watch paths | `/apps/api/**`, `/packages/schemas/**`, `/packages/config-ts/**`, `/package.json`, `/pnpm-lock.yaml`, `/pnpm-workspace.yaml` |
| Region / replicas | US East (the closest to Québec), 1 |
| Restart policy | On failure |

Variables:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | `3001` (fixed, so the front end can reach the API on the private network) |
| `API_URL` | `https://api.grandlivre.romain.re` |
| `APP_URL` | `https://grandlivre.romain.re` (the links in the emails, and the logo they show: `<APP_URL>/icon-192.png`) |
| `CORS_ORIGINS` | `https://grandlivre.romain.re` |
| `COOKIE_DOMAIN` | `grandlivre.romain.re` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Railway reference: the database's private URL) |
| `BETTER_AUTH_SECRET` | A new secret for production, never the development one: `openssl rand -base64 32` (see "What must stay as it is") |
| `RESEND_API_KEY` | A Resend key of Grand Livre's own, with "Sending access", restricted to `mail.romain.re` (required: the API refuses to start without it in production) |
| `EMAIL_FROM` | `Grand Livre <grandlivre@mail.romain.re>`, on the domain verified in Resend |
| `ANTHROPIC_API_KEY` | A key of its own for production, in a Claude Console workspace with a monthly spend limit: notes, receipts and tag suggestions. Without it, the assistant answers that it is unavailable |
| `MISTRAL_API_KEY` | A key of its own for production, with a spending limit: the notes dictated through the microphone. Without it, dictating is unavailable |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Not set for now: sign-in by email only. To add Google later: an OAuth client in Google Cloud Console, with the redirect URI `https://api.grandlivre.romain.re/v1/auth/callback/google` |
| `RECURRING_RUN_EVERY_SECONDS` | Not set: every 15 minutes by default |

The pre-deploy command applies the pending migrations with the service's variables before the new version starts; if it fails, the deployment stops and the previous version keeps running.

### `www`

| Setting | Value |
| --- | --- |
| Source | GitHub repository, branch `main`, Root Directory empty |
| Build command | `pnpm --filter www build` |
| Start command | `pnpm --filter www start` |
| Healthcheck path | `/` |
| Watch paths | `/apps/www/**`, `/packages/**`, `/package.json`, `/pnpm-lock.yaml`, `/pnpm-workspace.yaml` |
| Region / replicas | US East, 1 |
| Restart policy | On failure |

Variables:

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | `https://api.grandlivre.romain.re` (read at build time: changing it needs a new build) |
| `API_URL` | `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:3001`: the server-side rendering calls the API on the private network |

### `Postgres`

- Added from Railway's PostgreSQL template, in the same project and region.
- **Backups:** Railway's own backups (the Backups tab) need its Pro plan. On the Hobby plan, the `backup` service below sends a nightly encrypted dump to Cloudflare R2, outside Railway.

### `backup`

A cron service: Railway starts it once a night, it dumps the database over the private network, encrypts the dump with `age` for the owner of the restore key, sends it to a private R2 bucket and stops. The image and its script are in [`infra/backup/`](../infra/backup/).

| Setting | Value |
| --- | --- |
| Source | GitHub repository, branch `main`, Root Directory `/infra/backup` |
| Builder | Dockerfile (`infra/backup/Dockerfile`) |
| Cron schedule | `0 8 * * *` (8:00 UTC: 3:00 in Montréal in winter, 4:00 in summer) |
| Watch paths | `/infra/backup/**` |
| Region / replicas | US East, 1 |
| Restart policy | Never: a failed backup shows in the logs, the next night runs anyway |

Variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `AGE_RECIPIENT` | The public key of the restore key (`age1…`). Its private key stays with the owner, in a password manager: never on Railway nor in the repository. Without it, the backups can't be read |
| `S3_ENDPOINT` | `https://<account id>.r2.cloudflarestorage.com` |
| `S3_BUCKET` | `grandlivre-backups`: a bucket of its own, since an R2 token can only be limited to whole buckets |
| `S3_PREFIX` | Not set: `grandlivre` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | An R2 API token, "Object Read & Write", limited to `grandlivre-backups` |

In R2, a lifecycle rule on the bucket deletes the backups older than 30 days.

### Restoring a backup

1. Download the backup from the R2 bucket (`grandlivre/grandlivre-<date>.dump.age`).
2. Decrypt it with the restore key, and restore it into an **empty** database, here the local one of `docker-compose.yml` (the image has the right `pg_dump`, `pg_restore` and `age`):
   ```sh
   docker build -t grandlivre-backup infra/backup
   docker exec grandlivre-postgres-1 psql -U grandlivre -c "CREATE DATABASE grandlivre_restore"
   docker run --rm --add-host host.docker.internal:host-gateway -v "$PWD":/work --entrypoint sh grandlivre-backup -c \
     "age --decrypt --identity /work/restore.key /work/grandlivre-<date>.dump.age | pg_restore --no-owner --no-privileges --dbname=postgres://grandlivre:grandlivre@host.docker.internal:5434/grandlivre_restore"
   ```
   `restore.key` is the private key, written to a file for the time of the restore, then deleted.
3. To put it back in production: empty the production database as in "Resetting the database", without redeploying, then restore into it with the same command over a connection to it (`railway connect Postgres`, or from the `api` service with `railway ssh`); then redeploy `api`, whose pre-deploy command applies the migrations newer than the backup.

The restore was tried on 2026-11-18: a dump of the development database, restored into an empty one, gave the same rows, table by table.

## Domains

1. In each service, Settings, Networking: add the custom domain (`grandlivre.romain.re` for `www`, `api.grandlivre.romain.re` for `api`). Railway shows a CNAME target and a TXT verification record for each.
2. In the DNS zone of `romain.re`, at its DNS provider, add:
   - `grandlivre` CNAME to the target shown for `www`;
   - `api.grandlivre` CNAME to the target shown for `api`;
   - the TXT records Railway asks for.
3. Railway issues the HTTPS certificates once the records resolve.

## Emails (Resend)

The emails are sent from `mail.romain.re`, a domain already verified in Resend for another family project: no DNS record to add for Grand Livre.

- Create an API key of Grand Livre's own, with "Sending access", restricted to `mail.romain.re`: it is `RESEND_API_KEY`, revoked without touching the other project.
- The sender, `grandlivre@mail.romain.re`, tells Grand Livre's emails apart; nobody reads its replies, and the emails never ask for one.
- Both projects share the domain's sending reputation and Resend's quota (100 emails a day, 3,000 a month on the free plan): far above what sign-in links and invitations need. A project of its own sending more would need a domain of its own (for instance `grandlivre.romain.re`, with its DKIM and SPF records at the DNS provider).

## First deployment

1. Merge `dev` into `stage`, then `stage` into `main`, after `pnpm typecheck`, `pnpm test` and `pnpm check` pass.
2. Create the Railway project (Hobby plan, US East) and connect the GitHub repository.
3. Add PostgreSQL and enable its backups, then the `api` and `www` services with the settings above.
4. Deploy `api` first (the pre-deploy command creates the tables), then `www`.
5. Add the domains and Railway's DNS records, and wait for the certificates.
6. Run the checks below.

## Checks after a deployment

On a computer and on a phone (Android, in Brave), at `https://grandlivre.romain.re`:

- **Signing in:** the email arrives styled, with the logo; the link signs in; then sign out and sign in with the code. Set the name, then change it on the profile page.
- **Appearance:** switch the language, the mode and the theme, and reload: the choices stay. Install the app from the account menu, and open it from the home screen.
- **A household:** create one, go through Getting started; invite a second address, accept from it, and switch between two households from the header.
- **Accounts and transactions:** add an account, record an expense, a transfer; the balances follow, in a second browser too (real time).
- **Quick entry:** a typed note, a note dictated through the microphone (on the phone, in Brave: it needs HTTPS), and a receipt photo turned, cropped and masked by touch before it is sent.
- **Import:** a full Desjardins CSV (accounts, then cards): the summary, the tabs, the filters and the bar at the bottom, on the phone too, with hundreds of lines; the balances against the bank's; undo it.
- **Recurring transactions and tags:** the suggestions from the history, and the tags suggested when sorting by payee.
- **Reports, budgets, help:** each page opens; the help's FAQ searches.

## Resetting the database before the launch

Only during the pre-launch, never after it:

1. Open a `psql` session on the production database with Railway's CLI (`railway link` to the project once, then `railway connect Postgres`), and run:
   ```sql
   DROP SCHEMA IF EXISTS drizzle CASCADE;
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```
2. Redeploy `api`: its pre-deploy command applies every migration again on the empty database.

Everyone is signed out, and every household, account and transaction is gone. The local development database has the same reset: `pnpm db:reset`.

## Day to day

- **Deploying:** every push to `main` redeploys the services whose watch paths changed. Railway doesn't run the tests: run `pnpm typecheck`, `pnpm test` and `pnpm check` before merging into `main`.
- **Migrations:** generated and committed as in development (`pnpm --filter api db:generate`); the pre-deploy command applies them. Keep them backward compatible with the running version (add a column before using it, remove it in a later deployment), since the old version serves requests until the new one is up.
- **Rolling back:** redeploy a previous deployment from the service's Deployments tab. Migrations aren't rolled back: a migration that must be undone needs a new migration.
- **Logs:** each service's Logs tab. Failed emails are logged with Resend's reason, never with their content; the Claude and Mistral APIs' failures without the member's note, photo or recording.
- **Cost:** about USD 5 a month on the Hobby plan (usage included up to USD 5); check the usage page during the first month, and the spending of the Claude and Mistral keys.
