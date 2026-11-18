import type { ThemeName } from "@repo/themes";
import {
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from "@repo/ui";
import type { Appearance } from "@/features/appearance/appearance";
import { ModeRadioGroup } from "@/features/appearance/ModeRadioGroup";
import { useAppearanceChoice } from "@/features/appearance/use-appearance-choice";
import { ThemeRadioGroup } from "@/features/theme/ThemeRadioGroup";
import { themeLabels } from "@/features/theme/theme";
import { m } from "@/paraglide/messages";

interface AppearanceSubMenuProps {
	/** Appearance read from the cookie when the page was rendered. */
	initialAppearance: Appearance;
	/** Theme read from the cookie when the page was rendered. */
	initialTheme: ThemeName;
}

/** The mode and theme, as a submenu of the account menu, its current choice beside its name. */
export function AppearanceSubMenu({
	initialAppearance,
	initialTheme,
}: AppearanceSubMenuProps) {
	const choice = useAppearanceChoice(initialAppearance, initialTheme);

	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger
				aria-label={m.appearance_menu_label({
					appearance: choice.current.label(),
					theme: themeLabels[choice.theme](),
				})}
			>
				<choice.current.Icon aria-hidden className="size-4" />
				<span className="flex-1">{m.appearance_label()}</span>
				<span aria-hidden className="text-muted-foreground text-xs">
					{themeLabels[choice.theme]()}
				</span>
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent>
				<ModeRadioGroup
					value={choice.appearance}
					onValueChange={choice.changeAppearance}
				/>
				<DropdownMenuSeparator />
				<ThemeRadioGroup
					value={choice.theme}
					onValueChange={choice.changeTheme}
				/>
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}
