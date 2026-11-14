import { createAuthResource } from "./auth/auth.resource";
import { createHouseholdsResource } from "./households/households.resource";
import { type ApiClientConfig, createApiClient } from "./http/client";
import { createInvitationsResource } from "./invitations/invitations.resource";
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
export type { HouseholdsResource } from "./households/households.resource";
export type { ApiClientConfig } from "./http/client";
export type { InvitationsResource } from "./invitations/invitations.resource";
export type { MeResource } from "./me/me.resource";

/** The API's resources, sharing one configuration. */
export function createApi(config: ApiClientConfig) {
	const client = createApiClient(config);
	return {
		auth: createAuthResource(client),
		households: createHouseholdsResource(client),
		invitations: createInvitationsResource(client),
		me: createMeResource(client),
	};
}

export type Api = ReturnType<typeof createApi>;
