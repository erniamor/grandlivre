import { createAuthResource } from "./auth/auth.resource";
import { type ApiClientConfig, createApiClient } from "./http/client";
import { createMeResource } from "./me/me.resource";

export type { Page, PageOptions } from "./api/page";
export type { AuthResource } from "./auth/auth.resource";
export {
	ApiError,
	ForbiddenError,
	NetworkError,
	NotFoundError,
	RateLimitError,
	ServerError,
	UnauthorizedError,
	ValidationError,
} from "./errors";
export type { ApiClientConfig } from "./http/client";
export type { MeResource } from "./me/me.resource";

/** The API's resources, sharing one configuration. */
export function createApi(config: ApiClientConfig) {
	const client = createApiClient(config);
	return {
		auth: createAuthResource(client),
		me: createMeResource(client),
	};
}

export type Api = ReturnType<typeof createApi>;
