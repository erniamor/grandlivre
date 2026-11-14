import type { Household, HouseholdRole, Profile } from "@repo/schemas";
import { api, json } from "@test/helpers/api";
import { signIn } from "@test/helpers/auth";
import { db } from "@/db/client";
import { householdMembers } from "@/db/schema";

export interface TestUser {
	id: string;
	cookie: string;
}

/** Signs a user in and returns their id with their session cookie. */
export async function signInUser(email: string): Promise<TestUser> {
	const cookie = await signIn(email);
	const profile = await json<Profile>(await api("/v1/me", { cookie }));
	return { id: profile.id, cookie };
}

/** Creates a household through the API, owned by the user of `cookie`. */
export async function createTestHousehold(
	cookie: string,
	name = "The Tremblays",
): Promise<Household> {
	const response = await api("/v1/households", {
		method: "POST",
		cookie,
		body: { name, currency: "CAD" },
	});
	return json<Household>(response);
}

/** Adds a user to a household directly, without going through an invitation. */
export async function addTestMember(
	householdId: string,
	userId: string,
	role: HouseholdRole = "member",
): Promise<void> {
	await db.insert(householdMembers).values({ householdId, userId, role });
}
