import {
	type Household,
	householdSchema,
	paginatedSchema,
	type ReceivedInvitation,
	receivedInvitationSchema,
} from "@repo/schemas";
import {
	type Page,
	type PageOptions,
	segment,
	toPage,
	withQuery,
} from "../api/page";
import type { ApiClient } from "../http/client";

const receivedPageSchema = paginatedSchema(receivedInvitationSchema);

/**
 * The invitations to join a household received by the signed-in user. An
 * invitation that expired, was cancelled or is addressed to someone else
 * rejects with a NotFoundError.
 */
export function createInvitationsResource(client: ApiClient) {
	return {
		/** The pending invitations addressed to the user's email. */
		async list({
			page,
			pageSize,
			signal,
		}: PageOptions = {}): Promise<Page<ReceivedInvitation>> {
			return toPage(
				await client.request({
					path: withQuery("/invitations", { page, pageSize }),
					response: receivedPageSchema,
					signal,
				}),
			);
		},

		/** Joins the household as a plain member and returns it. */
		async accept(invitationId: string): Promise<Household> {
			return client.request({
				method: "POST",
				path: `/invitations/${segment(invitationId)}/accept`,
				response: householdSchema,
			});
		},

		async decline(invitationId: string): Promise<void> {
			await client.request({
				method: "POST",
				path: `/invitations/${segment(invitationId)}/decline`,
			});
		},
	};
}

export type InvitationsResource = ReturnType<typeof createInvitationsResource>;
