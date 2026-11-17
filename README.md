# Grand Livre

A family finance app: the members of a household record the money coming in and going out of their accounts, personal or shared, and see where it goes. A pnpm monorepo with a React front end and a REST API. The product decisions are in the "Project" section of [`CLAUDE.md`](CLAUDE.md), and the roadmap in [`docs/roadmap.md`](docs/roadmap.md).

## What's in place

| Part | Content |
| --- | --- |
| API | Hono on Node: security headers, CORS, CSRF, body limit, validation, one error format, health check |
| Database | PostgreSQL with Drizzle: accounts tables, versioned migrations, local Docker database, test database |
| Sign-in | Passwordless with Better Auth: magic link, email code, Google once its OAuth credentials are set; emails through Resend, in every language |
| Front end | TanStack Start and TanStack Query: header (language, appearance, account), sign-in, name at first sign-in, profile, home page, example page for signed-in users, error and 404 pages |
| Languages | English (default), French and Spanish, with Paraglide JS |
| Appearance | Light, dark or system mode, and five themes, kept in cookies and rendered by the server |
| Installable app | Web app manifest, service worker, offline page, install offer |
| Tooling | TypeScript strict, Biome, Vitest, shared Zod schemas, typed API client |

The product's own domains are added on top (see "Adding a domain").

## Repository

A pnpm monorepo:

| Folder | Content |
| --- | --- |
| [`apps/api`](apps/api) | REST API: Hono, Drizzle, PostgreSQL, Better Auth |
| [`apps/www`](apps/www) | Front end: React, TanStack Start, TanStack Query, Paraglide JS |
| [`packages/schemas`](packages/schemas) | Zod schemas shared by the API and the front ends |
| [`packages/resources`](packages/resources) | Typed API client for the front ends |
| [`packages/ui`](packages/ui) | shadcn/ui components |
| [`packages/themes`](packages/themes) | Tailwind/shadcn themes (tokens, light and dark) |
| [`packages/config-ts`](packages/config-ts) | Shared TypeScript configurations |
| [`packages/utils`](packages/utils) | Pure utilities shared by several projects (empty for now) |
| [`docs`](docs) | Hosting options and deployment |

Each app and package has a `README.md` (how to use it) and a `CLAUDE.md` (the rules to follow when working on it). The root [`CLAUDE.md`](CLAUDE.md) holds the conventions of the whole repository.

## Prerequisites

- [Volta](https://volta.sh), which installs the pinned versions of Node (24) and pnpm (10.34.9). pnpm support in Volta needs `VOLTA_FEATURE_PNPM=1` in your shell profile; without it, `pnpm` runs on another Node version and the install fails on `engines`.
- [Docker](https://www.docker.com), for the local PostgreSQL database.

Use pnpm only, never npm or yarn.

## Getting started

```sh
pnpm install

# API: environment, database, migrations
cp apps/api/.env.example apps/api/.env   # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
pnpm --filter api db:up
pnpm --filter api db:migrate

# Front end: environment
cp apps/www/.env.example apps/www/.env

# API (http://localhost:3001) and front end (http://localhost:3000) together
pnpm dev
```

Docker must be running: the API needs its database (`pnpm --filter api db:up` starts it).

In development, sign-in emails (links and codes) are printed in the API's console. See [apps/api/README.md](apps/api/README.md) and [apps/www/README.md](apps/www/README.md) for the details.

## Adding a domain

In this order:

1. its Zod schemas in [`packages/schemas`](packages/schemas);
2. its tables in `apps/api/src/db/schema/`, then `pnpm --filter api db:generate`;
3. its routes in `apps/api/src/routes/<domain>/`, mounted in `apps/api/src/app.ts`;
4. its resource in [`packages/resources`](packages/resources);
5. its screens in `apps/www/src/features/<feature>/` and `apps/www/src/routes/`.

Hosting: [docs/hosting.md](docs/hosting.md), then [docs/deployment.md](docs/deployment.md).

## Commands

From the root:

| Command | Effect |
| --- | --- |
| `pnpm dev` | Start the API and the front end in parallel, with each line prefixed by its app |
| `pnpm typecheck` | Typecheck every app and package |
| `pnpm test` | Run every test suite (Docker must be running for the API's) |
| `pnpm build` | Build every app |
| `pnpm check` / `pnpm check:fix` | Lint and format with Biome / apply the fixes |
| `pnpm --filter <app> <script>` | Run a script of one app or package |

Run the typecheck, Biome and the tests of what you changed before considering a change done.

## Git

- `main` (production) ← `stage` (pre-production) ← `dev` (integration).
- Work on `feature/<topic>` or `fix/<topic>` branches created from `dev`.
- Commits follow Conventional Commits with the app or package as scope: `feat(api): ...`, `fix(schemas): ...`.
