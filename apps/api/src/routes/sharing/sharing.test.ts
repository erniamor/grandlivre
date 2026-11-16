import type {
	Settlement,
	SharedExpense,
	SharingOverview,
	Transaction,
} from "@repo/schemas";
import { api, json } from "@test/helpers/api";
import {
	addTestMember,
	createTestHousehold,
	signInUser,
	type TestUser,
} from "@test/helpers/households";
import { householdApi } from "@test/helpers/transactions";
import { describe, expect, it } from "vitest";

type Page<T> = { data: T[]; pagination: { total: number } };

/**
 * A household of Alice (owner), Bob and Carol, sharing expenses. Alice and
 * Bob each hold their own account; Alice's only shows its balance to the
 * others. They also hold a joint account.
 */
async function setUp({ enabled = true } = {}) {
	const alice = await signInUser("alice@example.com");
	const bob = await signInUser("bob@example.com");
	const carol = await signInUser("carol@example.com");
	const household = await createTestHousehold(alice.cookie);
	await addTestMember(household.id, bob.id);
	await addTestMember(household.id, carol.id);
	const h = householdApi(household.id);
	const alices = await h.account(alice, {
		name: "Alice's",
		visibility: "balance",
	});
	const bobs = await h.account(bob, { name: "Bob's" });
	const joint = await h.account(alice, {
		name: "Joint",
		holderIds: [alice.id, bob.id],
	});
	const groceries = await h.tag(alice, "Groceries");
	const enable = (user: TestUser, expenseSharing: boolean) =>
		api(`/v1/households/${household.id}`, {
			method: "PATCH",
			cookie: user.cookie,
			body: { expenseSharing },
		});
	if (enabled) {
		await enable(alice, true);
	}
	const base = `${h.base}/sharing`;
	const call = (user: TestUser, method: string, path = "", body?: unknown) =>
		api(`${base}${path}`, { method, cookie: user.cookie, body });
	const overview = async (user: TestUser = alice) =>
		json<SharingOverview>(await call(user, "GET"));
	const balanceOf = async (userId: string) =>
		(await overview()).balances.find((each) => each.userId === userId)?.balance;
	/** Alice pays from her own account, shared as given. */
	const expense = (
		amount: number,
		shares: unknown,
		fields: Record<string, unknown> = {},
	) => ({
		type: "expense",
		accountId: alices.id,
		date: "2026-11-14",
		payee: "IGA",
		lines: [{ amount, tagId: groceries.id }],
		shares,
		...fields,
	});
	const equally = (...users: TestUser[]) => ({
		mode: "equal",
		userIds: users.map((user) => user.id),
	});

	return {
		alice,
		bob,
		carol,
		household,
		h,
		groceries,
		alices,
		bobs,
		joint,
		enable,
		call,
		overview,
		balanceOf,
		expense,
		equally,
	};
}

describe("expense sharing", () => {
	it("is off by default: nothing can be shared, until an owner turns it on", async () => {
		const { alice, bob, h, enable, call, expense, equally } = await setUp({
			enabled: false,
		});

		const shared = await h.create(alice, expense(12_000, equally(alice, bob)));
		const overview = await call(alice, "GET");
		const byMember = await enable(bob, true);
		const byOwner = await enable(alice, true);

		expect(shared.status).toBe(409);
		expect(await shared.json()).toMatchObject({
			error: { code: "sharing_disabled" },
		});
		expect(overview.status).toBe(409);
		expect(byMember.status).toBe(403);
		expect(await byOwner.json()).toMatchObject({ expenseSharing: true });
	});

	it("records each one's part of an expense paid from one's own account, and who owes whom", async () => {
		const { alice, bob, carol, h, alices, overview, expense, equally } =
			await setUp();

		const created = await h.created(
			alice,
			expense(12_001, equally(alice, bob)),
		);

		expect(created.sharing).toEqual({
			paidBy: alice.id,
			split: { mode: "equal", userIds: [alice.id, bob.id] },
			parts: [
				{ userId: alice.id, amount: 6_001 },
				{ userId: bob.id, amount: 6_000 },
			],
		});
		expect(created.accountId).toBe(alices.id);
		expect(await overview()).toEqual({
			weights: [
				{ userId: alice.id, weight: 1 },
				{ userId: bob.id, weight: 1 },
				{ userId: carol.id, weight: 1 },
			],
			balances: [
				{
					userId: alice.id,
					name: "alice@example.com",
					isMember: true,
					balance: 6_000,
				},
				{
					userId: carol.id,
					name: "carol@example.com",
					isMember: true,
					balance: 0,
				},
				{
					userId: bob.id,
					name: "bob@example.com",
					isMember: true,
					balance: -6_000,
				},
			],
			suggestions: [{ fromUserId: bob.id, toUserId: alice.id, amount: 6_000 }],
		});
	});

	it("splits by weights or by amounts, and a shared refund lowers what is owed", async () => {
		const { alice, bob, h, balanceOf, expense } = await setUp();

		await h.created(
			alice,
			expense(10_000, {
				mode: "weights",
				parts: [
					{ userId: alice.id, weight: 60 },
					{ userId: bob.id, weight: 40 },
				],
			}),
		);
		await h.created(
			alice,
			expense(5_000, {
				mode: "amounts",
				parts: [{ userId: bob.id, amount: 5_000 }],
			}),
		);
		// The store refunds 10: half of it was Bob's
		await h.created(
			alice,
			expense(
				1_000,
				{ mode: "equal", userIds: [alice.id, bob.id] },
				{ type: "income" },
			),
		);

		expect(await balanceOf(bob.id)).toBe(-(4_000 + 5_000 - 500));
		expect(await balanceOf(alice.id)).toBe(8_500);
	});

	it("rejects a split that makes no sense, a joint account, and someone from outside", async () => {
		const { alice, bob, h, joint, expense, equally } = await setUp();
		const outsider = await signInUser("dave@example.com");
		const fieldOf = async (response: Response) =>
			((await response.json()) as { error: { details?: unknown } }).error
				.details;

		expect(
			await fieldOf(
				await h.create(
					alice,
					expense(10_000, {
						mode: "amounts",
						parts: [{ userId: bob.id, amount: 9_999 }],
					}),
				),
			),
		).toEqual([{ field: "shares", message: "share_amounts_mismatch" }]);
		expect(
			await fieldOf(
				await h.create(
					alice,
					expense(10_000, equally(alice, bob), { accountId: joint.id }),
				),
			),
		).toEqual([{ field: "shares", message: "share_account_not_personal" }]);
		expect(
			await fieldOf(
				await h.create(alice, expense(10_000, equally(alice, outsider))),
			),
		).toEqual([{ field: "shares", message: "share_member_invalid" }]);
		// Nothing was recorded
		expect((await json<Page<Transaction>>(await h.list(alice))).data).toEqual(
			[],
		);
	});

	it("follows a transaction's changes: kept, its parts on the new amount; replaced; stopped", async () => {
		const { alice, bob, h, alices, groceries, balanceOf, expense, equally } =
			await setUp();
		const created = await h.created(
			alice,
			expense(10_000, equally(alice, bob)),
		);
		const replace = async (body: unknown) =>
			json<Transaction>(await h.replace(alice, created.id, body));
		const plain = {
			type: "expense",
			accountId: alices.id,
			date: "2026-11-14",
			lines: [{ amount: 20_000, tagId: groceries.id }],
		};

		const kept = await replace(plain);
		expect(kept.sharing?.parts).toEqual([
			{ userId: alice.id, amount: 10_000 },
			{ userId: bob.id, amount: 10_000 },
		]);
		const stopped = await replace({ ...plain, shares: null });
		expect(stopped.sharing).toBeUndefined();
		expect(await balanceOf(bob.id)).toBe(0);
		await replace({ ...plain, shares: equally(bob) });
		expect(await balanceOf(bob.id)).toBe(-20_000);
	});

	it("shows a shared expense to the members it concerns, even on an account that only shows its balance", async () => {
		const { alice, bob, carol, h, call, expense, equally } = await setUp();
		const created = await h.created(
			alice,
			expense(12_000, equally(alice, bob)),
		);
		const expensesOf = async (user: TestUser) =>
			(await json<Page<SharedExpense>>(await call(user, "GET", "/expenses")))
				.data;

		// Bob can't open it as a transaction: Alice's account hides its details
		expect((await h.get(bob, created.id)).status).toBe(404);
		expect(await expensesOf(bob)).toEqual([
			{
				transactionId: created.id,
				type: "expense",
				date: "2026-11-14",
				payee: "IGA",
				amount: 12_000,
				paidBy: alice.id,
				parts: [
					{ userId: alice.id, amount: 6_000 },
					{ userId: bob.id, amount: 6_000 },
				],
			},
		]);
		// Carol has no part in it, and doesn't see Alice's account
		expect(await expensesOf(carol)).toEqual([]);
	});

	it("sets the default split, for an owner only", async () => {
		const { alice, bob, carol, call } = await setUp();
		const weights = {
			weights: [
				{ userId: alice.id, weight: 60 },
				{ userId: bob.id, weight: 40 },
				{ userId: carol.id, weight: 0 },
			],
		};

		expect((await call(bob, "PUT", "/weights", weights)).status).toBe(403);
		expect(
			(
				await json<SharingOverview>(
					await call(alice, "PUT", "/weights", weights),
				)
			).weights,
		).toEqual(weights.weights);
		expect(
			(
				await call(alice, "PUT", "/weights", {
					weights: [{ userId: alice.id, weight: 0 }],
				})
			).status,
		).toBe(422);
	});

	it("settles with a payment outside the accounts, by the one who pays or is paid", async () => {
		const { alice, bob, carol, h, call, balanceOf, expense, equally } =
			await setUp();
		await h.created(alice, expense(12_000, equally(alice, bob)));
		const payment = {
			fromUserId: bob.id,
			toUserId: alice.id,
			amount: 6_000,
			date: "2026-11-15",
			note: " Interac ",
		};

		expect((await call(carol, "POST", "/settlements", payment)).status).toBe(
			403,
		);
		expect(
			(
				await call(bob, "POST", "/settlements", {
					...payment,
					toUserId: bob.id,
				})
			).status,
		).toBe(422);
		const created = await json<Settlement>(
			await call(bob, "POST", "/settlements", payment),
		);

		expect(created).toMatchObject({ note: "Interac", transactionId: null });
		expect(await balanceOf(bob.id)).toBe(0);
		expect(await balanceOf(alice.id)).toBe(0);
		expect(
			(await json<Page<Settlement>>(await call(alice, "GET", "/settlements")))
				.data,
		).toHaveLength(1);
		expect(
			(await call(alice, "DELETE", `/settlements/${created.id}`)).status,
		).toBe(204);
		expect(await balanceOf(bob.id)).toBe(-6_000);
	});

	it("settles with a transfer between their accounts, deleted with it", async () => {
		const { alice, bob, h, alices, bobs, call, balanceOf, expense, equally } =
			await setUp();
		await h.created(alice, expense(12_000, equally(alice, bob)));
		const payment = {
			fromUserId: bob.id,
			toUserId: alice.id,
			amount: 6_000,
			date: "2026-11-15",
			transfer: { fromAccountId: bobs.id, toAccountId: alices.id },
		};

		const wrongAccounts = await call(bob, "POST", "/settlements", {
			...payment,
			transfer: { fromAccountId: alices.id, toAccountId: bobs.id },
		});
		const created = await json<Settlement>(
			await call(bob, "POST", "/settlements", payment),
		);

		expect(await wrongAccounts.json()).toMatchObject({
			error: {
				details: [
					{
						field: "transfer.fromAccountId",
						message: "settlement_account_invalid",
					},
				],
			},
		});
		expect(created.transactionId).not.toBeNull();
		const transfer = await json<Transaction>(
			await h.get(bob, created.transactionId ?? ""),
		);
		expect(transfer).toMatchObject({
			type: "transfer",
			accountId: bobs.id,
			toAccountId: alices.id,
			amount: 6_000,
		});
		expect(await balanceOf(bob.id)).toBe(0);
		// Deleting the settlement deletes its transfer
		expect(
			(await call(bob, "DELETE", `/settlements/${created.id}`)).status,
		).toBe(204);
		expect((await h.get(bob, transfer.id)).status).toBe(404);
		expect(await balanceOf(bob.id)).toBe(-6_000);
	});

	it("keeps the balance of someone who left, marked as no longer a member", async () => {
		const { alice, bob, household, h, overview, expense, equally } =
			await setUp();
		await h.created(alice, expense(12_000, equally(alice, bob)));

		await api(`/v1/households/${household.id}/members/${bob.id}`, {
			method: "DELETE",
			cookie: bob.cookie,
		});

		expect(
			(await overview()).balances.find((each) => each.userId === bob.id),
		).toMatchObject({ isMember: false, balance: -6_000 });
	});
});
