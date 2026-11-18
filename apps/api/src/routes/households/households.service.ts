import type {
	CreateHousehold,
	Household,
	HouseholdMember,
	HouseholdRole,
	Paginated,
	UpdateHousehold,
} from "@repo/schemas";
import { and, asc, count, eq, type InferSelectModel } from "drizzle-orm";
import { db, type Transaction } from "@/db/client";
import { householdMembers, households, users } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { publishHouseholdEvent } from "@/lib/events";
import { offsetOf, type PaginationQuery } from "@/lib/pagination";
import { hasAccounts } from "@/routes/accounts/accounts.service";

type HouseholdRow = InferSelectModel<typeof households>;

/** A household and the role of one of its members in it. */
export interface Membership {
	household: HouseholdRow;
	role: HouseholdRole;
}

export function toHousehold({ household, role }: Membership): Household {
	return {
		id: household.id,
		name: household.name,
		currency: household.currency,
		timeZone: household.timeZone,
		expenseSharing: household.expenseSharing,
		...(household.demo ? { demo: true } : {}),
		role,
		createdAt: household.createdAt.toISOString(),
	};
}

/** Creates a household owned by `userId`. */
export async function createHousehold(
	userId: string,
	input: CreateHousehold,
): Promise<Household> {
	return db.transaction(async (tx) => {
		const [household] = await tx.insert(households).values(input).returning();
		if (!household) {
			throw new Error("The household was not created");
		}
		await tx
			.insert(householdMembers)
			.values({ householdId: household.id, userId, role: "owner" });
		return toHousehold({ household, role: "owner" });
	});
}

/** The households `userId` belongs to, oldest first. */
export async function listHouseholds(
	userId: string,
	pagination: PaginationQuery,
): Promise<Paginated<Household>> {
	const isMine = eq(householdMembers.userId, userId);
	const [rows, [counted]] = await Promise.all([
		db
			.select({ household: households, role: householdMembers.role })
			.from(householdMembers)
			.innerJoin(households, eq(households.id, householdMembers.householdId))
			.where(isMine)
			.orderBy(asc(households.createdAt), asc(households.id))
			.limit(pagination.pageSize)
			.offset(offsetOf(pagination)),
		db.select({ total: count() }).from(householdMembers).where(isMine),
	]);
	return {
		data: rows.map(toHousehold),
		pagination: { ...pagination, total: counted?.total ?? 0 },
	};
}

/** The household and the user's role in it, or nothing if they aren't a member. */
export async function findMembership(
	householdId: string,
	userId: string,
): Promise<Membership | undefined> {
	const [row] = await db
		.select({ household: households, role: householdMembers.role })
		.from(householdMembers)
		.innerJoin(households, eq(households.id, householdMembers.householdId))
		.where(
			and(
				eq(householdMembers.householdId, householdId),
				eq(householdMembers.userId, userId),
			),
		);
	return row;
}

export async function updateHousehold(
	membership: Membership,
	input: UpdateHousehold,
): Promise<Household> {
	// Nothing to change: Drizzle rejects an empty update
	if (
		input.name === undefined &&
		input.currency === undefined &&
		input.timeZone === undefined &&
		input.expenseSharing === undefined
	) {
		return toHousehold(membership);
	}
	// Balances are amounts in the household's currency: changing it would
	// silently change what they are worth
	if (
		input.currency !== undefined &&
		input.currency !== membership.household.currency &&
		(await hasAccounts(membership.household.id))
	) {
		throw new AppError(
			409,
			"currency_locked",
			"The currency can't change once the household has accounts",
		);
	}
	const [household] = await db
		.update(households)
		.set(input)
		.where(eq(households.id, membership.household.id))
		.returning();
	if (!household) {
		throw new AppError(404, "not_found", "Household not found");
	}
	await publishHouseholdEvent(db, household.id, "household");
	return toHousehold({ household, role: membership.role });
}

/** The members of a household, in the order they joined. */
export async function listMembers(
	householdId: string,
	pagination: PaginationQuery,
): Promise<Paginated<HouseholdMember>> {
	const inHousehold = eq(householdMembers.householdId, householdId);
	const [rows, [counted]] = await Promise.all([
		db
			.select({
				userId: users.id,
				name: users.name,
				email: users.email,
				image: users.image,
				role: householdMembers.role,
				joinedAt: householdMembers.createdAt,
			})
			.from(householdMembers)
			.innerJoin(users, eq(users.id, householdMembers.userId))
			.where(inHousehold)
			.orderBy(asc(householdMembers.createdAt), asc(users.id))
			.limit(pagination.pageSize)
			.offset(offsetOf(pagination)),
		db.select({ total: count() }).from(householdMembers).where(inHousehold),
	]);
	return {
		data: rows.map((row) => ({
			...row,
			joinedAt: row.joinedAt.toISOString(),
		})),
		pagination: { ...pagination, total: counted?.total ?? 0 },
	};
}

/**
 * Locks the members of the household and returns them, so that two concurrent
 * changes can't both remove or demote "the other" owner and leave none.
 */
async function lockMembers(tx: Transaction, householdId: string) {
	return tx
		.select({ userId: householdMembers.userId, role: householdMembers.role })
		.from(householdMembers)
		.where(eq(householdMembers.householdId, householdId))
		.for("update");
}

function assertNotLastOwner(
	members: { userId: string; role: HouseholdRole }[],
	userId: string,
) {
	const otherOwners = members.filter(
		(member) => member.role === "owner" && member.userId !== userId,
	);
	if (otherOwners.length === 0) {
		throw new AppError(
			409,
			"last_owner",
			"A household must keep at least one owner",
		);
	}
}

const isMember = (householdId: string, userId: string) =>
	and(
		eq(householdMembers.householdId, householdId),
		eq(householdMembers.userId, userId),
	);

/** Changes a member's role; the last owner can't be demoted. */
export async function updateMemberRole(
	householdId: string,
	userId: string,
	role: HouseholdRole,
): Promise<void> {
	await db.transaction(async (tx) => {
		const members = await lockMembers(tx, householdId);
		const target = members.find((member) => member.userId === userId);
		if (!target) {
			throw new AppError(404, "not_found", "Member not found");
		}
		if (target.role === "owner" && role !== "owner") {
			assertNotLastOwner(members, userId);
		}
		await tx
			.update(householdMembers)
			.set({ role })
			.where(isMember(householdId, userId));
		await publishHouseholdEvent(tx, householdId, "members");
	});
}

/**
 * Removes a member from the household. Members can remove themselves (leave);
 * removing someone else takes an owner. The last owner can't leave.
 */
export async function removeMember(
	householdId: string,
	actor: { userId: string; role: HouseholdRole },
	userId: string,
): Promise<void> {
	if (actor.userId !== userId && actor.role !== "owner") {
		throw new AppError(
			403,
			"forbidden",
			"Only an owner of the household can remove a member",
		);
	}
	await db.transaction(async (tx) => {
		const members = await lockMembers(tx, householdId);
		const target = members.find((member) => member.userId === userId);
		if (!target) {
			throw new AppError(404, "not_found", "Member not found");
		}
		if (target.role === "owner") {
			assertNotLastOwner(members, userId);
		}
		await tx.delete(householdMembers).where(isMember(householdId, userId));
		await publishHouseholdEvent(tx, householdId, "members");
		// They no longer hold the accounts they held
		await publishHouseholdEvent(tx, householdId, "accounts");
	});
}
