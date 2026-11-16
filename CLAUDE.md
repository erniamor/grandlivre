# CLAUDE.md

> Root file of the pnpm monorepo. Keep this file short: rules specific to an app or a package go in a `CLAUDE.md` placed in its own folder (e.g. `apps/api/CLAUDE.md`), or in an imported file (`@docs/xxx.md`).

## Project

Grand Livre: a family finance app. The members of a household record the money coming in and going out of their accounts, personal or shared, and see where it goes. Built on a starter that provides passwordless sign-in (email and Google), the profile, the header menus (language, appearance, account), the installable app (PWA) and the API conventions.

Product decisions:

- Household: everything (accounts, tags, transactions) belongs to a household, which members join by email invitation. Its currency is set per household. A member is an owner (manages the household, its members and invitations) or a plain member. The data model lets a user belong to several households; the interface handles a single one for now, switching between households comes later.
- Accounts: each has a type (chequing, savings, credit card, cash, loan, other) and one or more holders. A cash account is a wallet: a withdrawal is a transfer to it, and counting what is in it records the gap (an adjustment) as what was spent and not noted; any account can be adjusted to what it really holds (a bank's balance) the same way; an account with several holders is a shared account. Only holders write to an account. The real balance is tracked (opening balance, reconciliation) and is negative for money owed. When its last holder leaves the household, an account stays without a holder until an owner of the household gives it one or deletes it. The household's currency can no longer change once an account exists. The tables are named `ledger_accounts` (Better Auth owns `accounts`).
- Visibility: the holder of an account chooses what the other members see of it: its details (default) or its balance only (transaction lines hidden, amounts still counted in totals and reports). No hidden accounts.
- Consolidated view (the "super account"): computed over every account of the household, never stored, debts included: assets, liabilities and the net balance. Transfers between accounts are neither income nor expense.
- Transactions: income, expense or transfer, split into lines; each line has an amount and at most one tag (none shows as "uncategorized"), so reports never count an amount twice. Any holder of an account writes its transactions, whoever recorded them; a transfer takes a holder of the account the money leaves. An account with transactions can no longer be deleted, only archived. Each transaction records its origin (manual, voice, receipt, import) and an external identifier for imports.
- Tags: a hierarchy (a tag has at most one parent), shared by the household and managed by any member; reports roll amounts up to the parents. A tag has a name per language (members can use different languages; a missing translation falls back to another language's name), unique among the tags of a same parent for each language: the same name can exist under different parents ("Car › Insurance", "Home › Insurance"), as distinct tags. A wide set of suggested tags, already translated, is offered to a household starting out: its members uncheck what doesn't concern them, then add the rest in one go. A tag that has child tags or transactions can't be deleted. Translating a new tag automatically comes with the Claude API.
- Amounts: integers in minor units (cents), never floats.
- Real time: Server-Sent Events from the API; writes go through the REST API and the front end refreshes its TanStack Query data on each event.
- Quick entry: natural-language text (typed or dictated) and receipt photos, both turned into a draft by the Claude API (`claude-opus-5-5`, low effort); the user always confirms a draft before it is saved. A transaction recorded from a note has the origin `voice`. When no tag fits, the assistant may propose a new one, named in every language: it is created only if the member accepts it, after seeing the existing tags that look like it (same name, a typo away, one name holding the other). The Claude API receives the note, the accounts, the tags and the recent payees with their tag, only from what the member may see.
- Receipt photos are never stored: they are sent to the Claude API, then discarded; the extracted data (merchant, date, total, taxes, lines) is kept.
- Settling shared expenses: optional per household, off by default (some households pool everything, personal accounts included). Once an owner turns it on, an expense or a refund paid from an account with a single holder can be split among members (equal parts, weights, amounts; a default split per household); balances and the fewest payments to settle are computed, never stored; a settlement is recorded with or without a transfer between the two members' accounts. A member sees the shared expenses they have a part in, even on an account that only shows its balance.
- Bank data: statement import (CSV/OFX) first; a direct bank connection through an aggregator is postponed.

Roadmap, in order: households and members; accounts and the consolidated view; tags and transactions; real time; reports; natural-language entry; receipt scan; recurring transactions; budgets; settling shared expenses (done). Then: cash (a wallet account per member, withdrawals as transfers to it, counting the wallet to record what wasn't noted); hiding sensitive parts of a photo before it is sent (crop and masks burnt into the image, the original stays in the browser); statement import (CSV/OFX, Desjardins first), which can create an account from a statement (opening balance and recent history) and spots duplicates (transactions already entered, receipts, recurring days); setting up a household step by step, with a "getting started" checklist, built on the import; then help (contextual hints, a help page and an FAQ).

The site is multilingual by default: English (default locale), French and Spanish from the start. Every user-facing text, route and piece of content exists in every locale; never hard-code a single-language string in the UI.

## Stack

- Monorepo: pnpm workspaces
- Front-end app (`www`): React + TanStack Start (TanStack Router routing, server functions), TanStack Query for server state
- i18n: Paraglide JS (`apps/www`); the API translates its emails itself
- Backend (`apps/api`): Hono on Node with Drizzle and PostgreSQL, consumed by the front end through `packages/resources`
- TypeScript in `strict` mode
- Data validation: Zod
- Styling: Tailwind CSS
- UI components: shadcn/ui
- Build / dev server: Vite
- Tests: Vitest
- Lint + format: Biome (no ESLint or Prettier)
- Package manager: pnpm only (never `npm` or `yarn`)
- Hosting: Railway by default (`www`, `api` and PostgreSQL); options in `docs/hosting.md`, setup in `docs/deployment.md`
- Node 24 and pnpm 10.34.9, pinned with Volta (`volta` field of the root `package.json`, requires `VOLTA_FEATURE_PNPM=1`), and enforced by `engines` + `engineStrict`. `.nvmrc` mirrors the Node major version.

## Monorepo structure

```
apps/
  www/          public front end (TanStack Start)
  api/          API (Hono)
  storybook/    Storybook for packages/ui (planned)
packages/
  ui/           shadcn components (use semantic tokens only)
  themes/       Tailwind/shadcn themes: tokens, light/dark variants, no components
  resources/    typed API resources, data access point for the front ends
  schemas/      Zod schemas shared by the API and the front ends (inputs, responses)
  config-ts/    base tsconfig
  utils/        pure utilities, no framework dependency
```


Dependency rules:

- `apps` depend on `packages`; a package never depends on an app.
- An app never imports code from another app. Anything shared goes in a package.
- Only create a new package if at least two apps need it. Until then, keep the code in the app.
- Internal packages are consumed directly as TypeScript source (`exports` pointing to `.ts`), with no build step of their own.
- Internal dependencies are declared with `"workspace:*"`. Shared versions (React, Zod, Vitest...) are centralized in the `catalog:` of `pnpm-workspace.yaml`.
- Internal package alias: `@repo/<package>` (e.g. `@repo/resources`).

## Commands

From the root:

- Install: `pnpm install`
- Dev an app: `pnpm --filter <app> dev`
- Build an app: `pnpm --filter <app> build`
- Build / test / check everything: `pnpm -r build`, `pnpm -r test`, `pnpm -r typecheck`
- Run a single test file: `pnpm --filter <app> test <path/file>`
- Lint + format (whole repo): `pnpm biome check .` (auto-fix: `pnpm biome check --write .`)
- Add a dependency to an app: `pnpm --filter <app> add <package>`

IMPORTANT: after any change, run the typecheck, Biome and the tests of the affected apps and packages before declaring the task done. If the change touches a shared package, also check every app that uses it.

Root shortcuts: `pnpm dev` (API and front end in parallel), `pnpm typecheck`, `pnpm test`, `pnpm build` (recursive), `pnpm check` / `pnpm check:fix` (Biome). Biome ignores `docs/`, Markdown files and generated files.

## Typical front-end app structure (TanStack Start)

- `src/routes/`: TanStack routes (file-based routing)
- `src/components/`: components specific to the app
- `src/features/`: code organized by feature
- `src/server/`: server functions and data access
- `src/lib/`: utilities specific to the app

Shared shadcn components live in `packages/ui`, not in each app.

## Code conventions

- TypeScript: no `any`; prefer `unknown` + narrowing. No `@ts-ignore` without a justifying comment.
- Function components only, one component per file, named in PascalCase; hooks as `useXxx`.
- Props explicitly typed with a named `interface` or `type`.
- Create several small, dedicated components, each with a single responsibility, rather than one big component that does several things. If a component handles several UI blocks or several concerns, split it.
- No business logic in components: extract it into hooks or pure functions.
- Absolute imports through the `@/` alias inside an app, and through `@repo/<package>` between packages. No relative paths that leave the app or package (`../../..`).
- Code style is dictated by Biome: don't debate formatting, run `biome check --write`.
- No new dependency without asking me first.
- Reuse existing components and utilities (including those in `packages/`) before creating new ones.

## TanStack Start (front-end apps)

- Never edit generated files by hand (e.g. `routeTree.gen.ts`).
- Load data in route `loader`s or through server functions, not in `useEffect`.
- Server code (database access, secrets, private environment variables) must never be imported on the client side.
- Validate server function inputs with a Zod schema before using them.
- Type search and route parameters through TanStack Router mechanisms.

## Validation (Zod)

- All data coming from outside (forms, URL parameters, request bodies, third-party API responses, environment variables) is validated with Zod before use.
- Define a schema once and derive the type from it: `type Xxx = z.infer<typeof xxxSchema>`. Don't duplicate the type by hand.
- Schemas shared by the API and the front ends live in `packages/schemas`; don't redefine the same schema in several apps. A schema used by a single app stays in that app.
- The Drizzle schema in `apps/api` is the source of truth for the database and Zod describes the API's inputs and outputs.
- Prefer `safeParse` when the error must be handled; `parse` only when failure should interrupt the flow.
- Validation error messages must be readable by the user for forms.

## UI: Tailwind and shadcn

- Style with Tailwind classes; no custom CSS unless justified.
- Merge conditional classes with `cn()`.
- Add a shadcn component with the CLI (`pnpm dlx shadcn@latest add <component>`) in `packages/ui` rather than copying it by hand.
- Use the semantic tokens from `packages/themes` (`bg-primary`, `text-muted-foreground`...) rather than hard-coded color values. Themes are defined only in `packages/themes`, never in an app or in `packages/ui`.
- Accessibility: semantic elements, labels on fields, visible focus, keyboard navigation.

## Tests

- Every new behavior or bug fix comes with a test.
- Test visible behavior (Testing Library), not implementation details.
- Never delete or disable a test to make CI pass.

## Git

- Long-lived branches:
  - `main`: production. Only receives merges from `stage` (or urgent fixes); every commit is deployable.
  - `stage`: pre-production. Receives merges from `dev` for client validation and final testing in an environment identical to production.
  - `dev`: integration. Working branches are merged here first; deployed to the development environment.
- Working branches: `feature/<topic>` and `fix/<topic>`, created from `dev` and merged back into `dev`. An urgent production fix branches from `main`, then is merged into `main`, `stage` and `dev`.
- Changes flow `dev` → `stage` → `main`, never the other way except for urgent fixes.
- Commits: Conventional Commits (`feat:`, `fix:`, `refactor:` ...), short and in the imperative; specify the scope with the app or package (e.g. `feat(api): ...`).
- Never push directly to `main` or `stage`; never commit `.env` or secrets.
- No commit or push unless I ask for it.
- At the end of each task, suggest the matching commit message (following the convention above), without committing.

## Way of working

- Read the existing code before changing it; follow the patterns already in place.
- For a change touching more than 3 files or several apps/packages, propose a plan first.
- Make the smallest coherent change; don't refactor what wasn't asked.
- Stay within the app or package concerned; flag any change needed elsewhere rather than making it silently.
- If an instruction is ambiguous, ask rather than guess.
- Clearly flag what couldn't be verified (test not run, behavior not tested in the browser).
- Replies to me in French. Everything written in files is in English: code, comments, test names, identifiers, documentation (README, CHANGELOG, `docs/`, `CLAUDE.md`) and commit messages. User-facing content is the exception: it goes through the i18n system in every supported locale.

## Never do

- Use npm or yarn, or edit `pnpm-lock.yaml` by hand.
- Import an app's code into another app, or make a package depend on an app.
- Disable Biome or TypeScript rules globally.
- Modify generated files or build folders.
- Introduce breaking changes in a shared package without checking and updating every app that uses it.
