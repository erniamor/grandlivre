# Deployment

How to deploy Grand Livre to [Railway](https://railway.com) (Hobby plan), from the `main` branch of its GitHub repository. Why Railway, and the alternatives: [hosting.md](hosting.md).

The examples use `app.example.com` for the front end and `api.example.com` for the API: replace them with the project's domains.

| Railway service | Content | Public URL |
| --- | --- | --- |
| `www` | Front end: TanStack Start built by Nitro into a Node server | `https://app.example.com` |
| `api` | API: Hono on Node | `https://api.example.com` |
| `Postgres` | PostgreSQL, managed by Railway, on a volume | none (private network only) |

The front end and the API share the parent domain `example.com`: the session cookie is set for it (`COOKIE_DOMAIN`), so the front end's server receives it and renders signed-in pages.

Each service runs **one instance**: Better Auth's rate limiting is kept in memory (see `apps/api/README.md`).

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
| Region / replicas | The project's region, 1 |
| Restart policy | On failure |

Variables:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | `3001` (fixed, so the front end can reach the API on the private network) |
| `API_URL` | `https://api.example.com` |
| `APP_URL` | `https://app.example.com` |
| `CORS_ORIGINS` | `https://app.example.com` |
| `COOKIE_DOMAIN` | `example.com` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Railway reference: the database's private URL) |
| `BETTER_AUTH_SECRET` | A new secret for production, never the development one: `openssl rand -base64 32` |
| `RESEND_API_KEY` | A Resend key with "Sending access", restricted to the sending domain |
| `EMAIL_FROM` | `<App name> <address on the domain verified in Resend>` |

The pre-deploy command applies the pending migrations with the service's variables before the new version starts; if it fails, the deployment stops and the previous version keeps running.

### `www`

| Setting | Value |
| --- | --- |
| Source | GitHub repository, branch `main`, Root Directory empty |
| Build command | `pnpm --filter www build` |
| Start command | `pnpm --filter www start` |
| Healthcheck path | `/` |
| Watch paths | `/apps/www/**`, `/packages/**`, `/package.json`, `/pnpm-lock.yaml`, `/pnpm-workspace.yaml` |
| Region / replicas | The project's region, 1 |
| Restart policy | On failure |

Variables:

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | `https://api.example.com` (read at build time: changing it needs a new build) |
| `API_URL` | `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:3001`: the server-side rendering calls the API on the private network |

### `Postgres`

- Added from Railway's PostgreSQL template, in the same project and region.
- **Backups:** enable the daily schedule in the service's Backups tab (kept 6 days), and the weekly one (kept 27 days). Backups can only be restored into the same project and environment, and deleting the volume deletes them.

## Domains

1. In each service, Settings, Networking: add the custom domain (`app.example.com` for `www`, `api.example.com` for `api`). Railway shows a CNAME target and a TXT verification record for each.
2. In the DNS zone of `example.com`, at the DNS provider, add:
   - `app` CNAME to the target shown for `www`;
   - `api` CNAME to the target shown for `api`;
   - the TXT records Railway asks for.
3. Railway issues the HTTPS certificates once the records resolve.

The email records of the Resend sending domain (DKIM, SPF, return path) are separate: don't change them.

## First deployment

1. Create the Railway project (Hobby plan, in the project's region) and connect the GitHub repository.
2. Add PostgreSQL, then the `api` and `www` services with the settings above, and enable the database backups.
3. Deploy `api` first (the pre-deploy command creates the tables), then `www`.
4. Add the domains and the DNS records, and wait for the certificates.
5. Check, on a phone and a computer:
   - sign in with the email link, then with the code;
   - set the name, then change it on the profile page;
   - switch the language, the mode and the theme, and reload: the choices stay.

## Day to day

- **Deploying:** every push to `main` redeploys the services whose watch paths changed. Railway doesn't run the tests: run `pnpm typecheck`, `pnpm test` and `pnpm check` before merging into `main`.
- **Migrations:** generated and committed as in development (`pnpm --filter api db:generate`); the pre-deploy command applies them. Keep them backward compatible with the running version (add a column before using it, remove it in a later deployment), since the old version serves requests until the new one is up.
- **Rolling back:** redeploy a previous deployment from the service's Deployments tab. Migrations aren't rolled back: a migration that must be undone needs a new migration.
- **Logs:** each service's Logs tab. Failed emails are logged with Resend's reason, never with their content.
- **Cost:** about USD 5 a month on the Hobby plan (usage included up to USD 5); check the usage page during the first month.
