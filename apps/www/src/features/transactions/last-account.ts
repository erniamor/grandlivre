import { useSyncExternalStore } from "react";

const LAST_ACCOUNT_KEY = "grandlivre:last-account";

const subscribe = () => () => {};

function read(): string | null {
	try {
		return window.localStorage.getItem(LAST_ACCOUNT_KEY);
	} catch {
		// Blocked storage (private browsing, site settings)
		return null;
	}
}

/** Remembers, on this device, the account the user last recorded on. */
export function rememberLastAccount(accountId: string): void {
	try {
		window.localStorage.setItem(LAST_ACCOUNT_KEY, accountId);
	} catch {
		// Not remembered: the form proposes the first account instead
	}
}

/**
 * The account the user last recorded on from this device, proposed for the
 * next transaction; null on the server, during hydration, and the first time.
 */
export function useLastAccountId(): string | null {
	return useSyncExternalStore(subscribe, read, () => null);
}
