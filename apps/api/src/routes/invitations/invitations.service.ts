import {
	HOUSEHOLD_INVITATION_EXPIRES_IN_DAYS,
	type Household,
	type HouseholdInvitation,
	type Paginated,
	type ReceivedInvitation,
} from "@repo/schemas";
import { and, asc, count, eq, gt } from "drizzle-orm";
import { db } from "@/db/client";
import {
	householdInvitations,
	householdMembers,
	households,
	users,
} from "@/db/schema";
import { householdInvitationEmail } from "@/emails/household-invitation";
import { env } from "@/env";
import type { AuthUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import type { Locale } from "@/lib/locale";
import { mailer } from "@/lib/mailer";
import { offsetOf, type PaginationQuery } from "@/lib/pagination";
import {
	type Membership,
	toHousehold,
} from "@/routes/households/households.service";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Where the invited person lands: signed in, they are shown their invitations. */
const invitationUrl = () => new URL("/dashboard", env.APP_URL).toString();

/** The name shown for a user: their name, or their email until they choose one. */
const displayName = (user: { name: string; email: string }) =>
	user.name || user.email;

const notExpired = () => gt(householdInvitations.expiresAt, new Date());

function notFound(): AppError {
	return new AppError(404, "not_found", "Invitation not found");
}

/**
 * Invites `email` to the household and emails them. Inviting the same email
 * again renews the invitation and sends the email again. If the email can't
 * be sent, nothing is saved.
 */
export async function inviteMember(
	{ household }: Membership,
	inviter: AuthUser,
	email: string,
	locale: Locale,
): Promise<HouseholdInvitation> {
	return db.transaction(async (tx) => {
		const [member] = await tx
			.select({ userId: users.id })
			.from(householdMembers)
			.innerJoin(users, eq(users.id, householdMembers.userId))
			.where(
				and(
					eq(householdMembers.householdId, household.id),
					eq(users.email, email),
				),
			);
		if (member) {
			throw new AppError(
				409,
				"already_member",
				"This person is already a member of the household",
			);
		}

		const expiresAt = new Date(
			Date.now() + HOUSEHOLD_INVITATION_EXPIRES_IN_DAYS * DAY_MS,
		);
		const [invitation] = await tx
			.insert(householdInvitations)
			.values({
				householdId: household.id,
				email,
				invitedBy: inviter.id,
				expiresAt,
			})
			.onConflictDoUpdate({
				target: [householdInvitations.householdId, householdInvitations.email],
				set: { invitedBy: inviter.id, expiresAt },
			})
			.returning();
		if (!invitation) {
			throw new Error("The invitation was not created");
		}

		// Inside the transaction: a failed sending rolls the invitation back
		await mailer.send(
			householdInvitationEmail({
				to: email,
				locale,
				inviter: displayName(inviter),
				household: household.name,
				url: invitationUrl(),
				expiresInDays: HOUSEHOLD_INVITATION_EXPIRES_IN_DAYS,
			}),
		);

		return {
			id: invitation.id,
			email: invitation.email,
			invitedByName: displayName(inviter),
			expiresAt: invitation.expiresAt.toISOString(),
			createdAt: invitation.createdAt.toISOString(),
		};
	});
}

/** The pending invitations of a household, oldest first. */
export async function listHouseholdInvitations(
	householdId: string,
	pagination: PaginationQuery,
): Promise<Paginated<HouseholdInvitation>> {
	const pending = and(
		eq(householdInvitations.householdId, householdId),
		notExpired(),
	);
	const [rows, [counted]] = await Promise.all([
		db
			.select({
				invitation: householdInvitations,
				inviter: { name: users.name, email: users.email },
			})
			.from(householdInvitations)
			.innerJoin(users, eq(users.id, householdInvitations.invitedBy))
			.where(pending)
			.orderBy(
				asc(householdInvitations.createdAt),
				asc(householdInvitations.id),
			)
			.limit(pagination.pageSize)
			.offset(offsetOf(pagination)),
		db.select({ total: count() }).from(householdInvitations).where(pending),
	]);
	return {
		data: rows.map(({ invitation, inviter }) => ({
			id: invitation.id,
			email: invitation.email,
			invitedByName: displayName(inviter),
			expiresAt: invitation.expiresAt.toISOString(),
			createdAt: invitation.createdAt.toISOString(),
		})),
		pagination: { ...pagination, total: counted?.total ?? 0 },
	};
}

export async function cancelInvitation(
	householdId: string,
	invitationId: string,
): Promise<void> {
	const deleted = await db
		.delete(householdInvitations)
		.where(
			and(
				eq(householdInvitations.id, invitationId),
				eq(householdInvitations.householdId, householdId),
			),
		)
		.returning({ id: householdInvitations.id });
	if (deleted.length === 0) {
		throw notFound();
	}
}

/**
 * The pending invitations addressed to the user's email. Signing in is what
 * proves the address is theirs, so an unverified email receives nothing.
 */
function addressedTo(user: AuthUser) {
	return and(
		eq(householdInvitations.email, user.email.toLowerCase()),
		notExpired(),
	);
}

export async function listReceivedInvitations(
	user: AuthUser,
	pagination: PaginationQuery,
): Promise<Paginated<ReceivedInvitation>> {
	if (!user.emailVerified) {
		return { data: [], pagination: { ...pagination, total: 0 } };
	}
	const mine = addressedTo(user);
	const [rows, [counted]] = await Promise.all([
		db
			.select({
				invitation: householdInvitations,
				household: { id: households.id, name: households.name },
				inviter: { name: users.name, email: users.email },
			})
			.from(householdInvitations)
			.innerJoin(
				households,
				eq(households.id, householdInvitations.householdId),
			)
			.innerJoin(users, eq(users.id, householdInvitations.invitedBy))
			.where(mine)
			.orderBy(
				asc(householdInvitations.createdAt),
				asc(householdInvitations.id),
			)
			.limit(pagination.pageSize)
			.offset(offsetOf(pagination)),
		db.select({ total: count() }).from(householdInvitations).where(mine),
	]);
	return {
		data: rows.map(({ invitation, household, inviter }) => ({
			id: invitation.id,
			household,
			invitedByName: displayName(inviter),
			expiresAt: invitation.expiresAt.toISOString(),
		})),
		pagination: { ...pagination, total: counted?.total ?? 0 },
	};
}

/** Joins the household as a plain member; the invitation is consumed. */
export async function acceptInvitation(
	user: AuthUser,
	invitationId: string,
): Promise<Household> {
	if (!user.emailVerified) {
		throw notFound();
	}
	return db.transaction(async (tx) => {
		const [invitation] = await tx
			.delete(householdInvitations)
			.where(and(eq(householdInvitations.id, invitationId), addressedTo(user)))
			.returning({ householdId: householdInvitations.householdId });
		if (!invitation) {
			throw notFound();
		}
		// Already a member (invited before joining another way): keep their role
		await tx
			.insert(householdMembers)
			.values({
				householdId: invitation.householdId,
				userId: user.id,
				role: "member",
			})
			.onConflictDoNothing();
		const [row] = await tx
			.select({ household: households, role: householdMembers.role })
			.from(householdMembers)
			.innerJoin(households, eq(households.id, householdMembers.householdId))
			.where(
				and(
					eq(householdMembers.householdId, invitation.householdId),
					eq(householdMembers.userId, user.id),
				),
			);
		if (!row) {
			throw new Error("The member was not added to the household");
		}
		return toHousehold(row);
	});
}

export async function declineInvitation(
	user: AuthUser,
	invitationId: string,
): Promise<void> {
	if (!user.emailVerified) {
		throw notFound();
	}
	const deleted = await db
		.delete(householdInvitations)
		.where(and(eq(householdInvitations.id, invitationId), addressedTo(user)))
		.returning({ id: householdInvitations.id });
	if (deleted.length === 0) {
		throw notFound();
	}
}
