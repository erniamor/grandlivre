import type { Profile } from "@repo/schemas";
import type { ThemeName } from "@repo/themes";
import { Link } from "@tanstack/react-router";
import { LogInIcon } from "lucide-react";
import { headerButtonClass } from "@/components/header-styles";
import { Logo } from "@/components/Logo";
import { MainNav } from "@/components/MainNav";
import { AppearanceMenu } from "@/features/appearance/AppearanceMenu";
import type { Appearance } from "@/features/appearance/appearance";
import { UserMenu } from "@/features/auth/UserMenu";
import { HouseholdMenu } from "@/features/households/HouseholdMenu";
import { LanguageMenu } from "@/features/i18n/LanguageMenu";
import { m } from "@/paraglide/messages";
import { getLocale, setLocale } from "@/paraglide/runtime";

interface HeaderProps {
	appearance: Appearance;
	/** The chosen theme, shown in the appearance menu. */
	theme: ThemeName;
	/** The signed-in user, null for a visitor. */
	me: Profile | null;
	/** The household chosen on this device, if any. */
	preferredHousehold?: string;
}

export function Header({
	appearance,
	theme,
	me,
	preferredHousehold,
}: HeaderProps) {
	return (
		<header className="border-inverse-border border-b bg-inverse text-inverse-foreground">
			<div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
				<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
					<Logo />
					{me && <HouseholdMenu preferredHousehold={preferredHousehold} />}
				</div>
				<div className="flex flex-wrap items-center gap-1">
					{/* Changing the language reloads the page in that language */}
					<LanguageMenu locale={getLocale()} onLocaleChange={setLocale} />
					<AppearanceMenu initialAppearance={appearance} initialTheme={theme} />
					{me ? (
						<UserMenu me={me} />
					) : (
						<Link to="/sign-in" className={headerButtonClass}>
							<LogInIcon aria-hidden className="size-5" />
							{m.sign_in_link()}
						</Link>
					)}
				</div>
			</div>
			{/* The app's pages are reserved to signed-in users */}
			{me && (
				<div className="mx-auto max-w-5xl px-4 pb-2">
					<MainNav preferredHousehold={preferredHousehold} />
				</div>
			)}
		</header>
	);
}
