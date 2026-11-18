import type { Profile } from "@repo/schemas";
import type { ThemeName } from "@repo/themes";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	CircleHelpIcon,
	CircleUserRoundIcon,
	DownloadIcon,
	HouseIcon,
	LogOutIcon,
	UserIcon,
} from "lucide-react";
import { useState } from "react";
import { headerButtonClass } from "@/components/header-styles";
import { AppearanceSubMenu } from "@/features/appearance/AppearanceSubMenu";
import type { Appearance } from "@/features/appearance/appearance";
import { useSessionChange } from "@/features/auth/use-session-change";
import { LanguageSubMenu } from "@/features/i18n/LanguageSubMenu";
import { IosInstallDialog } from "@/features/pwa/IosInstallDialog";
import { useInstall } from "@/features/pwa/use-install";
import { getApi } from "@/lib/api";
import { m } from "@/paraglide/messages";
import type { Locale } from "@/paraglide/runtime";

interface UserMenuProps {
	me: Profile;
	locale: Locale;
	onLocaleChange: (locale: Locale) => void;
	/** Appearance read from the cookie when the page was rendered. */
	appearance: Appearance;
	/** Theme read from the cookie when the page was rendered. */
	theme: ThemeName;
}

/**
 * The signed-in user's menu in the header: profile, household, help,
 * installing the app, the language and the appearance, sign-out.
 */
export function UserMenu({
	me,
	locale,
	onLocaleChange,
	appearance,
	theme,
}: UserMenuProps) {
	const session = useSessionChange();
	const signOut = useMutation({
		mutationFn: () => getApi().auth.signOut(),
		onSuccess: () => session.clear("/"),
	});
	const name = me.name || me.email;
	const installation = useInstall();
	const [iosHelpOpen, setIosHelpOpen] = useState(false);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						aria-label={m.account_menu_label({ name })}
						className={headerButtonClass}
					>
						<CircleUserRoundIcon aria-hidden className="size-6" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="min-w-56">
					<DropdownMenuLabel className="grid gap-0.5">
						<span className="truncate">{name}</span>
						{me.name && (
							<span className="truncate font-normal text-muted-foreground text-xs">
								{me.email}
							</span>
						)}
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem asChild>
						<Link to="/profile">
							<UserIcon aria-hidden className="size-4" />
							{m.profile_link()}
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link to="/household">
							<HouseIcon aria-hidden className="size-4" />
							{m.household_link()}
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link to="/help">
							<CircleHelpIcon aria-hidden className="size-4" />
							{m.help_link()}
						</Link>
					</DropdownMenuItem>
					{installation.installable && (
						<DropdownMenuItem
							onSelect={() =>
								installation.state === "ios"
									? setIosHelpOpen(true)
									: installation.install()
							}
						>
							<DownloadIcon aria-hidden className="size-4" />
							{m.install_menu_item()}
						</DropdownMenuItem>
					)}
					<DropdownMenuSeparator />
					{/* Changing the language reloads the page in that language */}
					<LanguageSubMenu locale={locale} onLocaleChange={onLocaleChange} />
					<AppearanceSubMenu
						initialAppearance={appearance}
						initialTheme={theme}
					/>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						disabled={signOut.isPending}
						onSelect={() => signOut.mutate()}
					>
						<LogOutIcon aria-hidden className="size-4" />
						{m.sign_out_button()}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			{/* Outside the menu, which closes when the item is chosen */}
			<IosInstallDialog open={iosHelpOpen} onOpenChange={setIosHelpOpen} />
		</>
	);
}
