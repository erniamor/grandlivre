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
import { PrivateModeToggle } from "@/features/privacy/PrivateModeToggle";
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
	/** This device hides what is sensitive on screen. */
	privateMode?: boolean;
}

/**
 * The app's band, on one line: the logo (its mark alone on a phone) and the
 * current household on one side; on the other, the private mode and the
 * account menu, which holds the language and the appearance. A visitor has
 * the language and appearance menus instead, and the sign-in link.
 */
export function Header({
	appearance,
	theme,
	me,
	preferredHousehold,
	privateMode = false,
}: HeaderProps) {
	return (
		<header className="border-inverse-border border-b bg-inverse text-inverse-foreground">
			<div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3 sm:gap-4">
				<div className="flex min-w-0 items-center gap-1 sm:gap-3">
					<Logo />
					{me && <HouseholdMenu preferredHousehold={preferredHousehold} />}
				</div>
				<div className="flex shrink-0 items-center gap-1">
					{me ? (
						<>
							<PrivateModeToggle initialPrivate={privateMode} />
							<UserMenu
								me={me}
								locale={getLocale()}
								// Changing the language reloads the page in that language
								onLocaleChange={setLocale}
								appearance={appearance}
								theme={theme}
							/>
						</>
					) : (
						<>
							<LanguageMenu locale={getLocale()} onLocaleChange={setLocale} />
							<AppearanceMenu
								initialAppearance={appearance}
								initialTheme={theme}
							/>
							<Link to="/sign-in" className={headerButtonClass}>
								<LogInIcon aria-hidden className="size-5" />
								{m.sign_in_link()}
							</Link>
						</>
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
