# Changelog

Token and theme additions, renames and removals.

## Unreleased

- Breaking: themes `stationery`, `synthwave`, `garden`, `brutalist` and `neutral` removed; `ledger` (new default), `raspberry`, `dusk`, `ink` and `citrus` replace them. A stored choice of a removed theme falls back to the default.

- Themes: `stationery` (new default), `synthwave`, `garden` and `brutalist` added.
- Breaking: theme `brand` removed; `stationery` replaces it as the default theme (`:root` without `data-theme`).
- `themeBarColors`: each theme's `--inverse` color, light and dark, for `<meta name="theme-color">`.

## 0.0.0

- shadcn semantic tokens: `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive` (with their `-foreground`), `border`, `input`, `ring`, `radius`.
- Project tokens: `inverse`, `inverse-foreground`, `inverse-muted-foreground`, `inverse-border`, `typeface-body`, `typeface-heading`.
- Themes: `brand` (default) and `neutral` (reference).
