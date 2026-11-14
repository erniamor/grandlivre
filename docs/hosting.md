# Hosting options

The default: **Railway** for `www`, `api` and PostgreSQL, set up in [deployment.md](deployment.md). Nothing in the code depends on it: this document lists what a host must provide and the alternatives, to revisit if the needs change.

## Default: Railway

- One provider for the front end, the API and the database, nothing sleeps, managed PostgreSQL with volume backups, deployment from Git, custom domains with a CNAME at the DNS provider. About USD 5 a month on the Hobby plan: the cheapest option without ops work.
- Pick the region closest to most users, and check it against the project's data residency needs (see below).
- Considered and left aside for a small project:
  - Render's free plan: services sleep after 15 minutes (about a minute to wake up), and its free PostgreSQL expires after 30 days.
  - Oracle Cloud Always Free: free but self-managed, and idle instances may be reclaimed.
  - Vercel or Cloudflare Workers: fine for `www` alone, but the API then needs a second provider, for little gain at this scale.
  - AWS: a managed PostgreSQL alone costs more than all of Railway, and the setup is heavy for a small app.

## What needs hosting

| Piece | Needs |
| --- | --- |
| `apps/www` (TanStack Start) | SSR runtime (Node or edge), CDN for static assets |
| `apps/api` (Hono) | Node process, PostgreSQL database, daily backups |
| Email sending | Chosen: Resend, sending domain in its EU region (Ireland), for magic links and sign-in codes |
| Personal data | Accounts (email, name), plus whatever the product stores: data location and backups matter |

Three constraints shape the choice:

- **Data residency:** where GDPR applies, personal data (database, backups, email provider) should be stored and processed in the EU or in a country with an adequacy decision. A region close to the users keeps compliance simple.
- **One API instance at first:** Better Auth's rate limiting is kept in memory, so it only counts the requests reaching one instance. Move it to the database before running several. A project that adds real time (Server-Sent Events, WebSockets) also needs a long-running process, not serverless functions, and a proxy that doesn't buffer streamed responses.
- **`www` and `api` must share a parent domain:** the browser calls the API directly with the session cookie, and the front end's server forwards that cookie to the API during rendering. In development both run on `localhost` (cookies ignore the port). In production, serve them on sibling subdomains (e.g. `app.example.com` and `api.example.com`) and set `COOKIE_DOMAIN` (Better Auth's cross-subdomain cookies), so the front end's server receives the cookie too. Two unrelated domains would block this (third-party cookies).

## Options

### 1. Split: `www` on Vercel or Netlify, `api` on a PaaS (Railway, Render, Fly.io, Scalingo, Clever Cloud)

Pros:
- Best-in-class front-end hosting: global CDN, preview deployment per branch, zero ops.
- The PaaS gives a managed PostgreSQL, deploys from Git and handles TLS.
- Scalingo and Clever Cloud are EU providers with EU-only regions.
- Each piece scales and fails independently.

Cons:
- Two providers, two bills, two dashboards.
- Data residency must be checked per service: front-end functions often run in the US by default, and not every PaaS offers every region.
- `www` and `api` on different domains: session cookies and CORS need care (a shared parent domain, e.g. `app.` and `api.`, keeps cookies simple).
- Usage-based pricing can rise with traffic spikes (functions, bandwidth).

### 2. One VPS in the required region with Coolify or Docker Compose

Pros:
- Everything in one place, in a region of our choice: simplest answer to data residency.
- Lowest, predictable monthly cost.
- Full control over versions, database and backups.

Cons:
- We own the ops: OS updates, security, monitoring, backups, restore tests.
- No automatic scaling; a traffic spike (launch, campaign) must fit on the server.
- Single point of failure unless we add a second server.

### 3. A major cloud provider (AWS, Google Cloud, Azure) in the required region

Pros:
- Managed database and storage, mature backups and scaling, wide choice of regions.
- Room to grow without changing provider.

Cons:
- Complex to set up and to bill; needs cloud expertise.
- Oversized for a small app.

## Choosing

- **Small project, low ops:** Railway for everything (the default), or option 1 with an EU PaaS (Scalingo, Clever Cloud) when data must stay in the EU.
- **Budget first:** option 2, a VPS with Coolify, on the condition that someone owns updates and backups.

To decide: where the users are, monthly budget, who handles ops, and expected number of simultaneous users.
