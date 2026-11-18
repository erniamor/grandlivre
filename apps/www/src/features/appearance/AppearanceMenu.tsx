import type { ThemeName } from "@repo/themes";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui";
import { headerButtonClass } from "@/components/header-styles";
import type { Appearance } from "@/features/appearance/appearance";
import { ModeRadioGroup } from "@/features/appearance/ModeRadioGroup";
import { useAppearanceChoice } from "@/features/appearance/use-appearance-choice";
import { ThemeRadioGroup } from "@/features/theme/ThemeRadioGroup";
import { themeLabels } from "@/features/theme/theme";
import { m } from "@/paraglide/messages";

interface AppearanceMenuProps {
	/** Appearance read from the cookie when the page was rendered. */
	initialAppearance: Appearance;
	/** Theme read from the cookie when the page was rendered. */
	initialTheme: ThemeName;
}

/**
 * The header's appearance menu (mode and theme) for a visitor; its icon
 * shows the current mode. A signed-in user finds it in their account menu.
 */
export function AppearanceMenu({
	initialAppearance,
	initialTheme,
}: AppearanceMenuProps) {
	const choice = useAppearanceChoice(initialAppearance, initialTheme);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label={m.appearance_menu_label({
						appearance: choice.current.label(),
						theme: themeLabels[choice.theme](),
					})}
					className={headerButtonClass}
				>
					<choice.current.Icon aria-hidden className="size-5" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<ModeRadioGroup
					value={choice.appearance}
					onValueChange={choice.changeAppearance}
				/>
				<DropdownMenuSeparator />
				<ThemeRadioGroup
					value={choice.theme}
					onValueChange={choice.changeTheme}
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
