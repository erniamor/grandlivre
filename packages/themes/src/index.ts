/** Themes offered to the users; the first one is the default. */
export const themes = ["ledger", "raspberry", "dusk", "ink", "citrus"] as const;

export type ThemeName = (typeof themes)[number];

/** Theme applied when `<html>` has no `data-theme` attribute. */
export const defaultTheme: ThemeName = "ledger";

export function isThemeName(value: unknown): value is ThemeName {
	return typeof value === "string" && themes.includes(value as ThemeName);
}

/**
 * Background of the header's band (`--inverse`) per theme and mode, for what
 * the browser paints around the page (`<meta name="theme-color">`), which
 * can't read CSS variables. Kept in sync with the CSS by the tests.
 */
export const themeBarColors: Record<
	ThemeName,
	{ light: string; dark: string }
> = {
	ledger: { light: "#0f172a", dark: "#020617" },
	raspberry: { light: "#4a0e2c", dark: "#10080d" },
	dusk: { light: "#e9e1f5", dark: "#0f0c14" },
	ink: { light: "#000000", dark: "#141414" },
	citrus: { light: "#3f6212", dark: "#1c2a07" },
};
