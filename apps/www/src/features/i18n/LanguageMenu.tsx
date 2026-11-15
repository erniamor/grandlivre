import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@repo/ui";
import { headerButtonClass } from "@/components/header-styles";
import { localeNames } from "@/features/i18n/locale-names";
import { m } from "@/paraglide/messages";
import { isLocale, type Locale, locales } from "@/paraglide/runtime";

interface LanguageMenuProps {
	locale: Locale;
	onLocaleChange: (locale: Locale) => void;
}

/** The header's language menu: its button shows the current language's code. */
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
				<DropdownMenuLabel>{m.language_label()}</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={locale}
					onValueChange={(value) => {
						if (isLocale(value) && value !== locale) {
							onLocaleChange(value);
						}
					}}
				>
					{locales.map((value) => (
						<DropdownMenuRadioItem key={value} value={value} lang={value}>
							{localeNames[value]}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
