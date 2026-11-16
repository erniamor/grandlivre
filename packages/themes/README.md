# @repo/themes

Tailwind v4 / shadcn themes: values only (colors, fonts, radii), no components.

## Usage

In the app's main stylesheet, in this order:

```css
@import "tailwindcss";
@import "@repo/themes/base.css";
@import "@repo/themes/ledger.css"; /* the default theme */
@import "@repo/themes/dusk.css"; /* other themes, if users can choose them */
```

- Theme: `data-theme="<name>"` attribute on `<html>`. Without the attribute, the default theme (`ledger`) applies.
- Dark mode: `dark` class on `<html>`, independent of the theme.
- Fonts: the theme declares the families (`--typeface-body`, `--typeface-heading`); the app loads them.
- Browser bar color: `themeBarColors[theme].light` / `.dark` (TypeScript), the `--inverse` color of each theme, for `<meta name="theme-color">`. The tests check it matches the CSS.

## Tokens

shadcn semantic variables (`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, with their `-foreground`, plus `border`, `input`, `ring`, `radius`), and project tokens:

| Token | Role | Utilities |
| --- | --- | --- |
| `--inverse`, `--inverse-foreground` | Contrasting band (header, footer) | `bg-inverse`, `text-inverse-foreground` |
| `--inverse-muted-foreground` | Secondary text on the band | `text-inverse-muted-foreground` |
| `--inverse-border` | Separators on the band | `border-inverse-border` |
| `--typeface-body`, `--typeface-heading` | Font families | `font-sans`, `font-heading` |

All colors are hexadecimal (sRGB).

## Themes

Five complete themes, light and dark, offered to the users, each in its own family of colors. All use system fonts (nothing to load), so their rendering varies slightly between platforms.

| Theme | Idea | Fonts | Radius |
| --- | --- | --- | --- |
| `ledger` (default) | An account ledger: a night navy band and ink, emerald to act, amber for what stands out, a bluish white page; slate night in dark mode | System sans-serif | `0.75rem` |
| `raspberry` | Raspberry and mint: a deep berry band over a blush white page, raspberry to act, mint accents; blackcurrant night | Sans-serif body, Didone headings (Bodoni 72, Didot; Georgia elsewhere) | `0.75rem` |
| `dusk` | The river at sunset: a pale lavender band over a warm white page, plum violet to act, coral accents; violet night | System sans-serif | `0.5rem` |
| `ink` | Black and white at their strongest, one cobalt blue, hard borders: made to be read easily | System sans-serif | `0.125rem` |
| `citrus` | Playful: bright orange to act, a lime band, a cream page | Rounded (SF Pro Rounded, Nunito) | `1rem` |

`dusk` is the one theme whose band is light in light mode: its band's text is dark.

## Verified contrasts

`pnpm --filter themes test` checks, for each theme and each mode, that every token is defined and that these pairs meet WCAG AA: text ≥ 4.5:1 (`background`/`foreground`, `background`/`muted-foreground`, `background`/`primary`, each surface with its `-foreground`, `inverse` with both its texts), focus ring ≥ 3:1 on `background`.

Not checked: the field border (`--input`).
