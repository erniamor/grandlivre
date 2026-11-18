import { useSyncExternalStore } from "react";

/**
 * Whether the screen matches `query` ("(min-width: 48rem)"), kept up to date
 * as it changes. False during server rendering and where the browser can't
 * tell (jsdom): what depends on it must render well either way.
 */
export function useMediaQuery(query: string): boolean {
	return useSyncExternalStore(
		(onChange) => {
			const list = window.matchMedia?.(query);
			list?.addEventListener?.("change", onChange);
			return () => list?.removeEventListener?.("change", onChange);
		},
		() => window.matchMedia?.(query).matches ?? false,
		() => false,
	);
}
