import { writePreferenceCookie } from "@/lib/cookies";

/** Whether this device hides what is sensitive on screen. */
export const PRIVATE_COOKIE = "private";

export function parsePrivateMode(value: unknown): boolean {
	return value === "1";
}

/**
 * Hides what is sensitive on screen, or shows it again, at once: the
 * attribute on <html> blurs what is marked sensitive (see `sensitiveClass`),
 * the cookie keeps the choice for the next visits on this device.
 */
export function applyPrivateMode(on: boolean): void {
	writePreferenceCookie(PRIVATE_COOKIE, on ? "1" : "0");
	if (on) {
		document.documentElement.dataset.private = "";
	} else {
		delete document.documentElement.dataset.private;
	}
}
