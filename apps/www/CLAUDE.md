# CLAUDE.md : apps/www

> Complements the root `CLAUDE.md`, which also applies here. Contains only the rules specific to this front-end application. The backend has its own file (`apps/api`).

## Role

Grand Livre's web app, for now: the header (language, appearance, account), sign-in, the profile, creating or joining a household (`/setup`), its settings (`/household`), its accounts (`/accounts`, with the forms to add and change one), its tags (`/tags`, likewise), its transactions (`/transactions`, with the form to record and change one), its recurring transactions (`/recurring`, likewise), its reports (`/reports`), the dashboard (`/dashboard`) and the installable app. The product's own screens are added as features and routes. Consumes the API of `apps/api` through `@repo/resources`.

## App-specific stack

- React + TanStack Start (file-based routing, loaders, server functions), on Vite 8, built for Node by Nitro (`nitro/vite`), served on `http://localhost:3000` in development
- Server state: TanStack Query, wired to the router with `@tanstack/react-router-ssr-query` (data loaded during server rendering is handed to the browser's cache)
- Data: the Hono API (`apps/api`) through `@repo/resources`
- Validation: Zod schemas from `@repo/schemas`, shared with the API
- i18n: Paraglide JS 2.9 (see "Languages")
- UI: components from `@repo/ui` (shadcn) and the themes of `@repo/themes`; icons from `lucide-react` (version shared with `@repo/ui` through the `catalog:`)
- Tests: Vitest (jsdom) and Testing Library

## Commands

- Dev: `pnpm --filter www dev` (fails if port 3000 is taken, rather than taking the API's 3001; copy `.env.example` to `.env` first)
- Build: `pnpm --filter www build` (a standalone Node server in `.output/`, built by Nitro); run it with `pnpm --filter www start`
- Tests: `pnpm --filter www test`
- Typecheck: `pnpm --filter www typecheck` (compiles the messages first, through the `i18n` script)

## Structure

- `src/routes/`: TanStack routes; one file per route, thin (loader + page component). `__root.tsx` renders the HTML document, the header and the appearance, and loads the signed-in user. `_authenticated.tsx` is the layout of the pages reserved to signed-in users (`_authenticated/*`); `_authenticated/_household.tsx` is the layout of those that work on a household (`_authenticated/_household/*`).
- `src/features/<feature>/`: components, hooks and logic specific to a feature (`appearance` (mode), `theme`, `pwa` (installing the app, the offline page, the manifest), `auth` (with `UserMenu`, the header's account menu), `profile` (`NameForm`, shared by `/welcome` and `/profile`), `households` (the user's households and the invitations they received, `SetupPage` to create or join one, `HouseholdPage` for its name, currency, time zone (`HouseholdTimeZoneField`; `time-zone-options.ts`: the platform's time zones, and the browser's, sent when a household is created), members and invitations), `accounts` (the household's accounts grouped by what they are to the user, the archived ones apart, `HouseholdBalance` for the consolidated view, `Amount` to show money, `AccountForm` shared by the pages that create and change an account, `account-form.ts` for its rules: the amount owed of a debt, who may change an account), `tags` (the household's tags: `tag-tree.ts` builds their tree, named and sorted in the user's language; `TagForm`, shared by the pages that create and change a tag, asks for a name per language; `SuggestedTagsPage` lets a household starting out uncheck the suggested tags that don't concern it, with `suggested-selection.ts` for what checking or unchecking a branch does), `transactions` (the household's transactions: `TransactionsPage` lists them by day, `TransactionFilters` narrows them on an account, a tag and a period, kept in the address (`transaction-filters.ts`), `RecentTransactions` shows the last ones on the dashboard, `transaction-view.ts` holds what a transaction shows: which way the money goes, its tags' names, the grouping by day; `TransactionFields`, what a transaction is made of (type, lines, accounts, payee, note), shared by `TransactionForm` and `RecurringForm`; `TransactionForm`, shared by the pages that record and change a transaction, with `transaction-form.ts` for its rules: reading what was typed, pre-filling, who may change a transaction; `useLocalToday()` and `useLastAccountId()` for what only the browser knows: the user's day, the account they last recorded on; `QuickEntry` turns a note, or the photo of a receipt (`ReceiptScanButton`; `receipt-photo.ts` shrinks the photo to a JPEG of 1600 pixels at most before sending it), into a draft of the assistant, handed to the form through the query cache with the receipt's photo (`note-draft.ts`: `useOpenDraft()`, `useNoteDraft()`, `useDraftPhoto()`; the photo stays in the browser's memory, never stored), where `ProposedTagPanel` shows a proposed tag and its look-alikes, `AssistantNotes` the assistant's remark and warnings, `ReceiptDetails` the photo and what was read on it; `withOrigin()` records where the transaction comes from, with the receipt's details), `recurring` (the household's recurring transactions: `RecurringPage` lists them with how often (`schedule-label.ts`) and when next; `RecurringForm`, shared by the pages that create and change one, adds `ScheduleFields` and `RecurringModeField` to `TransactionFields`, with `recurring-form.ts` for its rules: reading what was typed, a first day never past in the household's time zone unless kept from before, the API's errors on `transaction.*` named as the form's; on the dashboard, `PendingRecurring` lists the days waiting for a member, to check and record (`ConfirmOccurrencePage`, the transaction form filled by `draftOfOccurrence()`) or skip, and `UpcomingRecurring` the next days to come; `recurring-view.ts` holds what a recurring transaction shows), `reports` (`ReportsPage`: a period's expenses and incomes, tag by tag; `report-tree.ts` builds what it shows from the API's raw amounts: each tag with its sub-tags added, its refunds taken off, the uncategorized expenses and incomes kept apart; `period.ts` for months, years and other dates; `ReportTrend` charts the twelve months ending with the period, the expenses and the income as two single-series bar charts on one scale, in the theme's primary color, with a table of the figures), `realtime` (`useHouseholdEvents()`, opened by the household layout: listens to the household's events and reloads what each one makes out of date; `stale-queries.ts` maps each topic to the queries to reload), `dashboard` (the home of a signed-in user), `i18n` (`LanguageMenu`; `locale-names.ts`, each language named in itself), `home`)
- `src/components/`: generic components specific to this app (`Header`, `MainNav` (the links to the app's pages, with their names, under the header's menus: add a page of the product there), `Logo`, `header-styles.ts` (`headerButtonClass`, for buttons on the header's band), `SelectField` (`tone`: `inverse` or `default`), `TextField`, `InlineEditForm`, `ConfirmButton` (an action confirmed in a dialog, as text or as an icon), `IconButton` (icon only, with an `aria-label` and a tooltip), `WithTooltip`, `FormAlert`, `Loading`, `NotFound`, `ErrorView`; shared components go in `packages/ui`)
- `src/server/`: server-only code (`env.ts`: the server's API URL)
- `src/lib/`: utilities specific to the app (`api.ts`: the API client; `error-messages.ts`: error codes to messages (`formErrors()` for a form, `actionErrorMessage()` for a toast); `validate-field.ts`: one field checked with its schema before an optimistic change; `redirect.ts`: the safe `redirect` search parameter; `dates.ts`: `formatDay()`, a calendar day in words, the same on the server and in every browser, and `todayIn()`, today in a household's time zone; `money.ts`: amounts in minor units to text in the household's currency (`formatAmount()`, signed on request; `formatAmountCompact()` for a chart's axis), to and from the text of an input (`formatAmountInput()`, `parseAmount()`, which reads the language's format and its common variants); `cookies.ts`)
- `src/env.ts`: public environment variables (`VITE_*`), validated with Zod
- `src/test/`: test helpers (`setTestLocale()`, `renderWithRouter()`, `renderWithQueryClient()`, `mockApi()` (its `respond` also gets the full URL, to read the query string), `mockSystemAppearance()`)
- `src/router.tsx`: creates the router and the `QueryClient`
- `src/server.ts`: server entry; runs Paraglide's middleware around TanStack Start's handler
- `src/styles.css`: Tailwind, the themes and `@repo/ui`'s styles
- `messages/<locale>.json`: the translations; `project.inlang/`: Paraglide's configuration
- `public/`: static files served as is: the icons (generated by `scripts/generate-icons.mjs`, never edited by hand) and the service worker (`sw.js`)
- `src/routeTree.gen.ts` (committed) and `src/paraglide/` (ignored): generated, never edit

## Languages

- English (`en`, default), French (`fr`) and Spanish (`es`). Every user-facing text is a message in `messages/<locale>.json`, present in all three files, used as `m.<key>()` from `@/paraglide/messages`.
- The locale isn't in the URL: it comes from the `PARAGLIDE_LOCALE` cookie (the user's choice in the header), then the browser's language, then English. On the server, `src/server.ts` detects it for each request.
- The language is chosen in the header's menu (`LanguageMenu`). Changing it calls `setLocale()`, which stores the cookie and reloads the page.
- The language names in the selector are written in their own language (`Français`), the same in every locale.
- The Paraglide options are set twice, in `vite.config.ts` and in the `i18n` script of `package.json`: keep them in sync.
- In tests, `setTestLocale(locale)` renders the messages in a given locale.

## Appearance

- The header's appearance menu (`AppearanceMenu`, whose icon shows the current mode) holds two choices: the mode (`ModeRadioGroup`) and the theme (`ThemeRadioGroup`).
- Mode: light, dark or system, stored in the `appearance` cookie. `getAppearance()` reads it on the server and in the browser; the root route renders the `dark` class on `<html>` so the page doesn't flash.
- With "system", the server can't know the system's appearance: a small inline script sets the class before the first paint, and `<html>` has `suppressHydrationWarning` for that reason.
- Theme: one of the themes offered by `@repo/themes` (`themes`), stored in the `theme` cookie, read on the server (`getTheme()`) and rendered as `data-theme` on `<html>`: no flash. A missing or no longer offered theme falls back to the default one (`stationery`).
- `styles.css` imports every offered theme; a theme added to `@repo/themes` needs its import there and its label (`themeLabels`, `theme_<name>` messages).
- The choices are kept per device (cookies), not in the account.

## Installable app (PWA)

- The manifest is a server route (`routes/manifest[.]webmanifest.ts`, built by `webManifest(locale)`), linked with the page's language: it's fetched without cookies.
- `public/sw.js` is plain JavaScript, outside the build: it only caches `/assets/*` (hashed, immutable) and the offline page, which the page itself stores (`registerServiceWorker()`, production builds only). Never cache pages or API responses: what's shown must be up to date.
- `listenForInstallPrompt()` runs when the root route's module loads, since the browser's offer can come before hydration. `useInstall()` is "unknown" on the server and during hydration: install offers only render in the browser.
- In the app installed on iOS (`useIsIosApp()`), sign-in sends a code instead of a link: the app doesn't share Safari's cookies.
- `theme-color` tags are written in the document's `<head>` (not in `head()`, which keeps one tag per name), one per system appearance; `applyThemeColor()` updates them when the appearance or theme changes. Their colors come from `themeBarColors` of `@repo/themes`.
- After changing the logo or its colors, run `pnpm --filter www icons`.

## API and session

- Every call goes through `getApi()` (`src/lib/api.ts`), the resources of `@repo/resources`. In the browser it calls the API directly with the session cookie (`credentials: "include"`); during server rendering it forwards the incoming request's cookie. Both send the app's language as `Accept-Language`.
- The signed-in user is the `me` query (`features/auth/me-query.ts`): `null` for a visitor. The root route loads it and puts it in the route context (`context.me`), used by the header and the routes' checks.
- If the API can't be reached, the root's `beforeLoad` fails and its context stays empty: the document (`RootDocument`) then reads the appearance and the theme from their cookies itself and shows a visitor's header, around `ErrorView`, which says the app can't be reached (`NetworkError`). Never make the document depend on the API.
- After signing in, out or changing the profile, call `useSessionChange()` (`refresh` or `clear`): it updates the `me` query, drops every other cached query (the previous user's data), re-runs the routes' checks and navigates.
- A page reserved to signed-in users goes under `src/routes/_authenticated/`. A page of the product, which works on a household, goes under `src/routes/_authenticated/_household/` (`dashboard.tsx` is the example to copy) and reads `household` from the route context: the layout loads the user's households (`householdsQueryOptions()`), takes the current one (`currentHousehold()`, the first: the interface handles a single household for now) and sends a user without a household to `/setup`, which brings them back once they created or joined one (`useHouseholdChange()`). `/` sends signed-in users to `/dashboard`, where the installed app also opens (`START_URL`). A signed-in user without a name is sent to `/welcome` first (root route).
- A `redirect` search parameter is always parsed with `redirectSearchSchema`: only internal paths are kept, so a link can't send users to another site.
- Query options and keys (`queryOptions`) live in the features, not in `@repo/resources`.
- Real time: while a household's pages are open, `_household.tsx` listens to its events (`useHouseholdEvents()`). A new query of a household's data goes under `["households", householdId, ...]` and is listed in `staleQueries()` (`features/realtime/stale-queries.ts`) under the topic that changes it, or it won't follow the other members' changes. `["households"]` alone is the list of the user's households: reload it with `exact`, or every household's data goes with it.

## Icons and tooltips

- Icons come from `lucide-react`, always `aria-hidden`: the control carries the text.
- An icon-only control has an accessible name (`aria-label`, which can be more precise than its tooltip: "Delete “Milk”" for "Delete") and a tooltip (`IconButton`, `WithTooltip`). Tooltips don't show on touch screens, so they never hold information found nowhere else.
- One `TooltipProvider` wraps the app in the root route, and the components rendered by the test helpers.

## Toasts

- One `<Toaster />` in the root route; call `toast` from `@repo/ui` for a message that must survive a navigation or doesn't belong to a form. Errors about a form stay next to it (`FormAlert`, field errors).

## Routes and data

- A route defines its `loader` to load data; the page component doesn't `fetch` in a `useEffect`.
- Path and search parameters are typed and validated with Zod in the route definition.
- Handle the three states on each page: loading, error, empty data. Use the routes' error and pending components.
- API calls go through `@repo/resources`, never through a hand-written `fetch` in a component.
- Authentication-related redirects happen in the route's `beforeLoad`, not in the component.

## Components

- A page is an assembly of small, dedicated components: the route composes, the components in `features/` render.
- A component used by several apps moves to `packages/ui`; as long as only this app uses it, it stays here.
- Presentational components receive typed props and don't call the API themselves; data fetching happens in the route or in a dedicated hook.
- No `useEffect` to derive state or load data; use it only to synchronize with an external system.
- Memoization (`useMemo`, `useCallback`, `memo`) only if a performance problem has been measured.

## Forms

- Each form has a Zod schema from `@repo/schemas`, used on the client for UX and by the API for security.
- Show validation errors next to the relevant field, with a readable message: schema messages are error codes (`name_required`), translated through the i18n system.
- For an optimistic change, validate the input with its schema (`validateField()`) first, so an invalid value never shows.
- Disable the submit button during submission and show the result (success or error).
- Every field has an associated `label`.

## Styling and accessibility

- Tailwind classes only; use the semantic tokens from `@repo/themes`, no hard-coded colors. The app imports `base.css` and the desired themes in its main stylesheet, declares `@source` for `packages/ui`, and doesn't redefine tokens.
- Responsive design: mobile first, then Tailwind breakpoints.
- Semantic HTML elements (`button`, `nav`, `main`, `h1` to `h6` in order), keyboard navigation, visible focus, alt text on images.
- The theme and dark mode are stored in a cookie read on the server and applied to `<html>` during server rendering, not in `localStorage`, to avoid flashes and hydration errors.
- Check the rendering in light and dark for each theme offered.

## Performance

- Lazy-load heavy routes and components.
- Size and optimize images; don't import a whole library for a single function.
- Don't block rendering on data that isn't essential to the initial display.

## Tests

- Test components with Vitest and Testing Library, from the user's point of view (roles, labels, visible text).
- Prioritize testing forms, `features/` logic and error cases.
- Mock the API at the `resources` or network level; don't call a real API in tests. In practice: `vi.mock("@/lib/api", () => ({ getApi: vi.fn() }))` in the test file, then `mockApi(respond)` answers the requests and returns them.

## Never do

- Modify `routeTree.gen.ts` or any generated file.
- Import code from another app, or from `src/server/` into a client component.
- Expose a private environment variable to the client; only explicitly public variables may be exposed.
- Duplicate a Zod schema or a type already present in `packages/schemas` or `packages/resources`.
- Bypass authentication or authorization on the client side assuming they aren't checked on the server: they must be enforced in the backend (the middlewares of `apps/api`).
