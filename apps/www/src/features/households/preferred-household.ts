import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { readCookie, writePreferenceCookie } from "@/lib/cookies";

/** The household the user last chose on this device, by its id. */
export const HOUSEHOLD_COOKIE = "household";

/** An id as the cookie holds it; anything else is no choice. */
export function parsePreferredHousehold(value: unknown): string | undefined {
	return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)
		? value
		: undefined;
}

/**
 * The household the user last chose on this device: from the request on
 * the server, from `document.cookie` in the browser. Kept per device, like
 * the theme, so the server renders it without a flash.
 */
export const getPreferredHousehold = createIsomorphicFn()
	.server(() => parsePreferredHousehold(getCookie(HOUSEHOLD_COOKIE)))
	.client(() =>
		parsePreferredHousehold(readCookie(document.cookie, HOUSEHOLD_COOKIE)),
	);

/** Remembers the household chosen, for the next pages and visits on this device. */
export function rememberHousehold(householdId: string): void {
	writePreferenceCookie(HOUSEHOLD_COOKIE, householdId);
}
