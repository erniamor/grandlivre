# www

Grand Livre's web app: for now the screens that come before the product's own (sign-in, profile, language, appearance), ready to receive its features. Built with React and TanStack Start, TanStack Query, Paraglide JS for translations, Tailwind CSS and the components of [`@repo/ui`](../../packages/ui).

What's in place: a header (logo, then menus for the language, the appearance and the account: profile and sign-out), sign-in by magic link or code, the name asked at the first sign-in, a home page for visitors, creating or joining a household, the dashboard of signed-in users, the installable app (PWA), and the 404 and error pages.

## Screens

| Path | Screen |
| --- | --- |
| `/` | Presentation for visitors; signed-in users go to `/dashboard` |
| `/sign-in`, `/welcome` | Sign-in, then the name at the first sign-in |
| `/profile` | The user's email, and their name to change |
| `/setup` | For a signed-in user without a household: accept an invitation received, or create a household (name, currency). Opened automatically; goes on to the page asked for |
| `/household` | The household's settings, opened from the account menu: its name and currency, its members (roles, removing, leaving) and its pending invitations (inviting, sending again, cancelling). Owners change them; plain members read them and can leave |
| `/accounts` | The household's accounts with their balance, grouped: the user's own, those shared with other members, the other accounts of the household; with the household's consolidated balance (assets, debts, net) |
| `/dashboard` | Home of a signed-in user, in their household, with its consolidated balance: the starting point of the product's own pages |
| `/offline` | Shown by the service worker when a page can't load without a connection |

The app calls the API through [`@repo/resources`](../../packages/resources): it needs the API running (see [apps/api/README.md](../api/README.md)).

## Environment

Copy `.env.example` to `.env`:

| Variable | Description |
| --- | --- |
| `VITE_API_URL` | Public URL of the API, called by the browser (exposed to the client) |
| `API_URL` | Optional: URL of the API for the server's requests during rendering (e.g. an internal address). Defaults to `VITE_API_URL`. Read from the process environment, not from `.env` |

## Sign-in

1. `/sign-in`: the user enters their email and receives a magic link, which brings them back to the page they asked for (`?redirect=`).
2. If the link doesn't work for them (another device, for example), "Get a code instead" emails a 6-digit code to enter on the page.
3. At the first sign-in, `/welcome` asks for their name, shown in the account menu.

In the app installed on an iPhone or iPad, the email's link would open in Safari, whose cookies the app doesn't share: there, the page sends the code directly.

Pages reserved to signed-in users live under `src/routes/_authenticated/`: visitors are sent to `/sign-in`, then brought back.

## Development

```sh
pnpm --filter www dev   # http://localhost:3000
```

`http://localhost:3000` is the origin the API allows in development (`CORS_ORIGINS` of `apps/api`).

## Scripts

| Script | Effect |
| --- | --- |
| `dev` | Development server on port 3000 |
| `build` | Production build: a standalone Node server in `.output/` (Nitro) |
| `start` | Runs the production build (`PORT`, 3000 by default) |
| `i18n` | Compiles the messages into `src/paraglide/` (also done by `dev`, `build` and the tests) |
| `typecheck` | Compiles the messages, then checks the types |
| `icons` | Draws the app's icons into `public/` from the logo (`scripts/generate-icons.mjs`, no dependency); run it after changing the logo or its colors |
| `test` | Runs the tests (Vitest, jsdom) |

Run them from the repository root with `pnpm --filter www <script>`.

## Languages

English (default), French and Spanish. The texts are in `messages/en.json`, `messages/fr.json` and `messages/es.json`: add every new key to the three files, then use it as `m.key()`:

```tsx
import { m } from "@/paraglide/messages";

<h1>{m.home_title()}</h1>
```

The language isn't part of the URL. It comes from the user's choice (a cookie set by the header's selector), otherwise from the browser's language, otherwise English. Compiling the messages downloads Paraglide's plugins from jsdelivr the first time, so it needs network access.

## Appearance

Light, dark or the system's, and one of the themes of `@repo/themes`, chosen in the header's appearance menu. Each choice is stored in a cookie so the server renders the right appearance directly, with no flash on load.

## Installable app (PWA)

The app can be installed on a phone or a computer, and opens on `/dashboard` in its own window.

- `/manifest.webmanifest?lang=<locale>`: the manifest, in the page's language (a server route, `src/routes/manifest[.]webmanifest.ts`).
- `public/`: the icons (`icons` script) and the service worker, `sw.js`. The service worker keeps the build's files (hashed names) and shows `/offline` when a page can't load; it never caches pages or API data. It's only registered by production builds: check it with `build` then `start`.
- Installing: Chromium browsers (Android, Chrome and Edge on computers) show their own dialog from the app's "Install" button. iPhones and iPads can't be prompted: the app explains the Share menu's "Add to Home Screen". The offer is a card on the dashboard ("Not now" hides it for 30 days on the device) and an item of the account menu, both hidden once installed.
- `<meta name="theme-color">` follows the theme and the mode: the installed app's bars take the header's color.

## Deployment

Built by Nitro into a standalone Node server (`.output/server/index.mjs`), deployed on Railway: see [docs/deployment.md](../../docs/deployment.md). `VITE_API_URL` is read at build time.
