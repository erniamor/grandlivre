import {
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
} from "@repo/ui";
import { localeNames } from "@/features/i18n/locale-names";
import { m } from "@/paraglide/messages";
import { isLocale, type Locale, locales } from "@/paraglide/runtime";

interface LanguageRadioGroupProps {
	locale: Locale;
	/** Called with another language only: choosing the current one does nothing. */
	onLocaleChange: (locale: Locale) => void;
}

/** The languages in a dropdown menu, each named in itself. */
export function LanguageRadioGroup({
	locale,
	onLocaleChange,
}: LanguageRadioGroupProps) {
	return (
		<>
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
		</>
	);
}
