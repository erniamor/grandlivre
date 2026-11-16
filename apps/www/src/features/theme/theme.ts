import { defaultTheme, isThemeName, type ThemeName } from "@repo/themes";
import { writePreferenceCookie } from "@/lib/cookies";
import { m } from "@/paraglide/messages";

export const THEME_COOKIE = "theme";

export const themeLabels: Record<ThemeName, () => string> = {
	ledger: m.theme_ledger,
	raspberry: m.theme_raspberry,
	dusk: m.theme_dusk,
	ink: m.theme_ink,
	citrus: m.theme_citrus,
};

/** The chosen theme; a missing or no longer offered one falls back to the default. */
export function parseTheme(value: unknown): ThemeName {
	return isThemeName(value) ? value : defaultTheme;
}

/** Applies the theme to the page and remembers it for the next visits. */
export function applyTheme(theme: ThemeName): void {
	writePreferenceCookie(THEME_COOKIE, theme);
	document.documentElement.dataset.theme = theme;
}
