import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Today as a calendar day ("2026-11-14") on this device's clock. */
export function localToday(now = new Date()): string {
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Today for the user, or an empty string on the server and during
 * hydration: the server doesn't know the user's time zone, where it may
 * already be tomorrow or still yesterday.
 */
export function useLocalToday(): string {
	return useSyncExternalStore(
		subscribe,
		() => localToday(),
		() => "",
	);
}
