import {
	type CreateDemoHousehold,
	type CreateHousehold,
	createDemoHouseholdSchema,
	createHouseholdSchema,
	type GettingStarted,
	gettingStartedSchema,
	type Household,
	type HouseholdInvitation,
	type HouseholdMember,
	householdInvitationSchema,
	householdMemberSchema,
	householdSchema,
	type InviteHouseholdMember,
	inviteHouseholdMemberSchema,
	paginatedSchema,
	type UpdateGettingStarted,
	type UpdateHousehold,
	type UpdateHouseholdMember,
	updateGettingStartedSchema,
	updateHouseholdMemberSchema,
	updateHouseholdSchema,
} from "@repo/schemas";
import {
	type Page,
	type PageOptions,
	segment,
	toPage,
	withQuery,
} from "../api/page";
import { type ApiClient, parseInput } from "../http/client";

const householdsPageSchema = paginatedSchema(householdSchema);
const membersPageSchema = paginatedSchema(householdMemberSchema);
const invitationsPageSchema = paginatedSchema(householdInvitationSchema);

const householdPath = (householdId: string) =>
	`/households/${segment(householdId)}`;

/**
 * The households of the signed-in user, with their members and the
 * invitations they sent. A household the user isn't a member of rejects with
 * a NotFoundError; an action reserved to owners with a ForbiddenError.
 */
export function createHouseholdsResource(client: ApiClient) {
	return {
		/** The user's households, oldest first, with their role in each. */
		async list({
			page,
			pageSize,
			signal,
		}: PageOptions = {}): Promise<Page<Household>> {
			return toPage(
				await client.request({
					path: withQuery("/households", { page, pageSize }),
					response: householdsPageSchema,
					signal,
				}),
			);
		},

		async get(
			householdId: string,
			options: { signal?: AbortSignal } = {},
		): Promise<Household> {
			return client.request({
				path: householdPath(householdId),
				response: householdSchema,
				signal: options.signal,
			});
		},

		/** The user becomes the owner of the new household. */
		async create(input: CreateHousehold): Promise<Household> {
			return client.request({
				method: "POST",
				path: "/households",
				body: parseInput(createHouseholdSchema, input),
				response: householdSchema,
			});
		},

		/**
		 * A household of made-up data for the user, to try the app or show it:
		 * it replaces their demo household, if they had one.
		 */
		async createDemo(input: CreateDemoHousehold = {}): Promise<Household> {
			return client.request({
				method: "POST",
				path: "/households/demo",
				body: parseInput(createDemoHouseholdSchema, input),
				response: householdSchema,
			});
		},

		/**
		 * Deletes a demo household and everything in it, for its owner. A real
		 * household rejects with an ApiError `household_not_demo` (409).
		 */
		async remove(householdId: string): Promise<void> {
			await client.request({
				method: "DELETE",
				path: householdPath(householdId),
			});
		},

		/** Owners only. Changes the fields given. */
		async update(
			householdId: string,
			input: UpdateHousehold,
		): Promise<Household> {
			return client.request({
				method: "PATCH",
				path: householdPath(householdId),
				body: parseInput(updateHouseholdSchema, input),
				response: householdSchema,
			});
		},

		members: {
			/** In the order they joined. */
			async list(
				householdId: string,
				{ page, pageSize, signal }: PageOptions = {},
			): Promise<Page<HouseholdMember>> {
				return toPage(
					await client.request({
						path: withQuery(`${householdPath(householdId)}/members`, {
							page,
							pageSize,
						}),
						response: membersPageSchema,
						signal,
					}),
				);
			},

			/**
			 * Owners only. Rejects with an ApiError `last_owner` (409) when it
			 * would leave the household without an owner.
			 */
			async update(
				householdId: string,
				userId: string,
				input: UpdateHouseholdMember,
			): Promise<void> {
				await client.request({
					method: "PATCH",
					path: `${householdPath(householdId)}/members/${segment(userId)}`,
					body: parseInput(updateHouseholdMemberSchema, input),
				});
			},

			/**
			 * Removes a member (owners only), or leaves the household when
			 * `userId` is the signed-in user. Rejects with an ApiError
			 * `last_owner` (409) for the last owner.
			 */
			async remove(householdId: string, userId: string): Promise<void> {
				await client.request({
					method: "DELETE",
					path: `${householdPath(householdId)}/members/${segment(userId)}`,
				});
			},
		},

		invitations: {
			/** The household's pending invitations, oldest first. */
			async list(
				householdId: string,
				{ page, pageSize, signal }: PageOptions = {},
			): Promise<Page<HouseholdInvitation>> {
				return toPage(
					await client.request({
						path: withQuery(`${householdPath(householdId)}/invitations`, {
							page,
							pageSize,
						}),
						response: invitationsPageSchema,
						signal,
					}),
				);
			},

			/**
			 * Owners only. Emails the invitation; inviting the same email again
			 * renews it. Rejects with an ApiError `already_member` (409) for a
			 * member's email.
			 */
			async create(
				householdId: string,
				input: InviteHouseholdMember,
			): Promise<HouseholdInvitation> {
				return client.request({
					method: "POST",
					path: `${householdPath(householdId)}/invitations`,
					body: parseInput(inviteHouseholdMemberSchema, input),
					response: householdInvitationSchema,
				});
			},

			/** Owners only. Cancels a pending invitation. */
			async remove(householdId: string, invitationId: string): Promise<void> {
				await client.request({
					method: "DELETE",
					path: `${householdPath(householdId)}/invitations/${segment(invitationId)}`,
				});
			},
		},

		/**
		 * Where the household stands in its first steps, as the user sees it:
		 * each step done or not, how many of their transactions are left
		 * without a tag, and whether they hid it.
		 */
		async gettingStarted(
			householdId: string,
			options: { signal?: AbortSignal } = {},
		): Promise<GettingStarted> {
			return client.request({
				path: `${householdPath(householdId)}/getting-started`,
				response: gettingStartedSchema,
				signal: options.signal,
			});
		},

		/** Hides the first steps from the user's dashboard, or shows them again. */
		async updateGettingStarted(
			householdId: string,
			input: UpdateGettingStarted,
		): Promise<GettingStarted> {
			return client.request({
				method: "PUT",
				path: `${householdPath(householdId)}/getting-started`,
				body: parseInput(updateGettingStartedSchema, input),
				response: gettingStartedSchema,
			});
		},
	};
}

export type HouseholdsResource = ReturnType<typeof createHouseholdsResource>;
