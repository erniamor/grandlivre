import type { Locale } from "@/paraglide/runtime";

// Each language is named in itself, so anyone can find theirs whatever the
// current language: these names are the same in every locale
export const localeNames: Record<Locale, string> = {
	en: "English",
	fr: "Français",
	es: "Español",
};
