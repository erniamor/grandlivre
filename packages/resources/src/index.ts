import { createAccountsResource } from "./accounts/accounts.resource";
import { createAuthResource } from "./auth/auth.resource";
import { createEventsResource } from "./events/events.resource";
import { createHouseholdsResource } from "./households/households.resource";
import { type ApiClientConfig, createApiClient } from "./http/client";
import { createInvitationsResource } from "./invitations/invitations.resource";
import { createMeResource } from "./me/me.resource";
import { createTagsResource } from "./tags/tags.resource";
import { createTransactionsResource } from "./transactions/transactions.resource";

export type { AccountsResource } from "./accounts/accounts.resource";
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
export type {
	EventsResource,
	HouseholdEventHandlers,
} from "./events/events.resource";
export type { HouseholdsResource } from "./households/households.resource";
export type { ApiClientConfig } from "./http/client";
export type { InvitationsResource } from "./invitations/invitations.resource";
export type { MeResource } from "./me/me.resource";
export type { TagsResource } from "./tags/tags.resource";
export type {
	TransactionFilters,
	TransactionsResource,
} from "./transactions/transactions.resource";

/** The API's resources, sharing one configuration. */
export function createApi(config: ApiClientConfig) {
	const client = createApiClient(config);
	return {
		accounts: createAccountsResource(client),
		auth: createAuthResource(client),
		events: createEventsResource(client),
		households: createHouseholdsResource(client),
		invitations: createInvitationsResource(client),
		me: createMeResource(client),
		tags: createTagsResource(client),
		transactions: createTransactionsResource(client),
	};
}

export type Api = ReturnType<typeof createApi>;
