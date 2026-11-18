import type { Profile } from "@repo/schemas";
import type { ThemeName } from "@repo/themes";
import { Toaster, TooltipProvider } from "@repo/ui";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	redirect,
	Scripts,
} from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { AppFrame } from "@/components/AppFrame";
import { Header } from "@/components/Header";
import {
	type Appearance,
	serverHtmlClass,
	systemAppearanceScript,
} from "@/features/appearance/appearance";
import { getAppearance } from "@/features/appearance/get-appearance";
import { meQueryOptions } from "@/features/auth/me-query";
import { getPreferredHousehold } from "@/features/households/preferred-household";
import { toastOffsetAboveTabBar } from "@/features/navigation/tab-bar";
import { getPrivateMode } from "@/features/privacy/get-private-mode";
import { listenForInstallPrompt } from "@/features/pwa/install-prompt";
import { registerServiceWorker } from "@/features/pwa/service-worker";
import { themeColorMetas } from "@/features/pwa/theme-color";
import { getTheme } from "@/features/theme/get-theme";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import stylesUrl from "@/styles.css?url";

// As early as possible: the browser's install offer can come before hydration
if (typeof window !== "undefined") {
	listenForInstallPrompt(window);
}

interface RouterContext {
	queryClient: QueryClient;
}

/** What the document needs from the root's context. */
interface ShellContext {
	appearance: Appearance;
	theme: ThemeName;
	me: Profile | null;
	/** The household chosen on this device, if any (see currentHousehold). */
	preferredHousehold: string | undefined;
	/** This device hides what is sensitive on screen. */
	privateMode: boolean;
}

export const Route = createRootRouteWithContext<RouterContext>()({
	beforeLoad: async ({ context, location }) => {
		const me = await context.queryClient.ensureQueryData(meQueryOptions());
		// A user without a name chooses one before anything else
		if (me && !me.name && location.pathname !== "/welcome") {
			throw redirect({ to: "/welcome", search: { redirect: location.href } });
		}
		return {
			appearance: getAppearance(),
			theme: getTheme(),
			me,
			preferredHousehold: getPreferredHousehold(),
			privateMode: getPrivateMode(),
		};
	},
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover",
			},
			{ title: m.app_name() },
			{ name: "apple-mobile-web-app-title", content: m.app_name() },
		],
		links: [
			{ rel: "stylesheet", href: stylesUrl },
			{ rel: "manifest", href: `/manifest.webmanifest?lang=${getLocale()}` },
			{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
			{ rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
	// Empty when beforeLoad failed (the API can't be reached): the document
	// still renders, around the error page
	const context: Partial<ShellContext> = Route.useRouteContext();
	const appearance = context.appearance ?? getAppearance();
	const theme = context.theme ?? getTheme();
	const me = context.me ?? null;
	const privateMode = context.privateMode ?? getPrivateMode();

	// Syncs with the browser: installable app, offline page
	useEffect(() => {
		void registerServiceWorker();
	}, []);

	return (
		// With the "system" appearance, the class set by the script below differs
		// from the server's: React must not treat it as a hydration error
		<html
			lang={getLocale()}
			data-theme={theme}
			data-private={privateMode ? "" : undefined}
			className={serverHtmlClass(appearance)}
			suppressHydrationWarning
		>
			<head>
				<HeadContent />
				{/* Installed app: the bars around the page take the header's color.
				Here rather than in head(), which keeps one tag per name */}
				{themeColorMetas(theme, appearance).map((meta) => (
					<meta key={meta.media} {...meta} />
				))}
				{/* Constant script: applies the system's appearance before the first paint */}
				{appearance === "system" && (
					<script
						dangerouslySetInnerHTML={{ __html: systemAppearanceScript }}
					/>
				)}
			</head>
			<body>
				{/* One provider for the app's tooltips: hovering from one to the next
				shows it without the delay */}
				<TooltipProvider>
					<Header
						appearance={appearance}
						theme={theme}
						me={me}
						preferredHousehold={context.preferredHousehold}
						privateMode={privateMode}
					/>
					<AppFrame
						signedIn={me !== null}
						preferredHousehold={context.preferredHousehold}
					>
						{children}
					</AppFrame>
				</TooltipProvider>
				<Toaster
					theme={appearance}
					position="bottom-center"
					// Above the tab bar of a signed-in user's phone
					{...(me && {
						offset: toastOffsetAboveTabBar,
						mobileOffset: toastOffsetAboveTabBar,
					})}
				/>
				<Scripts />
			</body>
		</html>
	);
}
