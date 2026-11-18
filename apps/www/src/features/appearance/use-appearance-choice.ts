import type { ThemeName } from "@repo/themes";
import { useState } from "react";
import {
	type Appearance,
	applyAppearance,
} from "@/features/appearance/appearance";
import { getAppearanceOption } from "@/features/appearance/appearance-options";
import { applyThemeColor } from "@/features/pwa/theme-color";
import { applyTheme } from "@/features/theme/theme";

/**
 * The mode and theme chosen on this device, from what the page was rendered
 * with: each change applies at once (the page, its cookie, the installed
 * app's bars), without reloading anything.
 */
export function useAppearanceChoice(
	initialAppearance: Appearance,
	initialTheme: ThemeName,
) {
	const [appearance, setAppearance] = useState(initialAppearance);
	const [theme, setTheme] = useState(initialTheme);
	return {
		appearance,
		theme,
		/** The current mode's label and icon. */
		current: getAppearanceOption(appearance),
		changeAppearance: (next: Appearance) => {
			setAppearance(next);
			applyAppearance(next);
			applyThemeColor(theme, next);
		},
		changeTheme: (next: ThemeName) => {
			setTheme(next);
			applyTheme(next);
			applyThemeColor(next, appearance);
		},
	};
}
