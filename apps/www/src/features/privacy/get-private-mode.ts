import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import {
	PRIVATE_COOKIE,
	parsePrivateMode,
} from "@/features/privacy/private-mode";
import { readCookie } from "@/lib/cookies";

/**
 * Whether this device hides what is sensitive, read from its cookie: from
 * the request on the server, from `document.cookie` in the browser.
 */
export const getPrivateMode = createIsomorphicFn()
	.server(() => parsePrivateMode(getCookie(PRIVATE_COOKIE)))
	.client(() => parsePrivateMode(readCookie(document.cookie, PRIVATE_COOKIE)));
