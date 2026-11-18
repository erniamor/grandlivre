import {
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from "@repo/ui";
import { LanguagesIcon } from "lucide-react";
import { LanguageRadioGroup } from "@/features/i18n/LanguageRadioGroup";
import { localeNames } from "@/features/i18n/locale-names";
import { m } from "@/paraglide/messages";
import type { Locale } from "@/paraglide/runtime";

interface LanguageSubMenuProps {
	locale: Locale;
	onLocaleChange: (locale: Locale) => void;
}

/** The languages, as a submenu of the account menu, the current one beside its name. */
export function LanguageSubMenu({
	locale,
	onLocaleChange,
}: LanguageSubMenuProps) {
	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger
				aria-label={m.language_menu_label({ language: localeNames[locale] })}
			>
				<LanguagesIcon aria-hidden className="size-4" />
				<span className="flex-1">{m.language_label()}</span>
				<span aria-hidden className="text-muted-foreground text-xs uppercase">
					{locale}
				</span>
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent>
				<LanguageRadioGroup locale={locale} onLocaleChange={onLocaleChange} />
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}
