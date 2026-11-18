import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@repo/ui";
import { headerButtonClass } from "@/components/header-styles";
import { LanguageRadioGroup } from "@/features/i18n/LanguageRadioGroup";
import { localeNames } from "@/features/i18n/locale-names";
import { m } from "@/paraglide/messages";
import type { Locale } from "@/paraglide/runtime";

interface LanguageMenuProps {
	locale: Locale;
	onLocaleChange: (locale: Locale) => void;
}

/**
 * The header's language menu for a visitor: its button shows the current
 * language's code. A signed-in user finds it in their account menu.
 */
export function LanguageMenu({ locale, onLocaleChange }: LanguageMenuProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label={m.language_menu_label({ language: localeNames[locale] })}
					className={headerButtonClass}
				>
					<span aria-hidden className="min-w-6 font-medium uppercase">
						{locale}
					</span>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<LanguageRadioGroup locale={locale} onLocaleChange={onLocaleChange} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
