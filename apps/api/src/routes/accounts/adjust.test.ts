import type { AdjustAccountResult } from "@repo/schemas";
import { api, json } from "@test/helpers/api";
import {
	addTestMember,
	createTestHousehold,
	signInUser,
	type TestUser,
} from "@test/helpers/households";
import { householdApi } from "@test/helpers/transactions";
import { describe, expect, it } from "vitest";

/**
 * Alice holds chequing and her wallet (100 $ in it); Bob is a member who
 * holds neither; Carol is outside the household.
 */
async function setUp() {
	const alice = await signInUser("alice@example.com");
	const bob = await signInUser("bob@example.com");
	const carol = await signInUser("carol@example.com");
	const household = await createTestHousehold(alice.cookie);
	await addTestMember(household.id, bob.id);
	const h = householdApi(household.id);
	const chequing = await h.account(alice, { name: "Chequing" });
	const wallet = await h.account(alice, {
		name: "Wallet",
		type: "cash",
		openingBalance: 10_000,
	});
	const outings = await h.tag(alice, "Outings");
	const adjust = (user: TestUser, accountId: string, body: unknown) =>
		api(`${h.base}/accounts/${accountId}/adjust`, {
			method: "POST",
			cookie: user.cookie,
			body,
		});
	const balanceOf = async (accountId: string) =>
		(await h.getAccount(alice, accountId)).balance;
	return {
		alice,
		bob,
		carol,
		h,
		chequing,
		wallet,
		outings,
		adjust,
		balanceOf,
	};
}

describe("POST /v1/households/:householdId/accounts/:accountId/adjust", () => {
	it("records what was spent and not noted, from the cash counted in a wallet", async () => {
		const { alice, h, chequing, wallet, adjust, balanceOf } = await setUp();
		// A withdrawal of 200, then a coffee noted: 270 expected
		await h.created(alice, {
			type: "transfer",
			accountId: chequing.id,
			toAccountId: wallet.id,
			date: "2026-11-10",
			amount: 20_000,
		});
		await h.created(alice, {
			type: "expense",
			accountId: wallet.id,
			date: "2026-11-11",
			lines: [{ amount: 3_000 }],
		});

		const response = await adjust(alice, wallet.id, {
			balance: 15_000,
			date: "2026-11-15",
		});

		expect(response.status).toBe(200);
		const { adjustment, balance } = await json<AdjustAccountResult>(response);
		expect(balance).toBe(15_000);
		expect(adjustment).toMatchObject({
			type: "expense",
			accountId: wallet.id,
			date: "2026-11-15",
			amount: 12_000,
			origin: "adjustment",
			lines: [{ amount: 12_000, tagId: null }],
		});
		expect(await balanceOf(wallet.id)).toBe(15_000);
	});

	it("records an income when the account holds more, on the tag chosen", async () => {
		const { alice, wallet, outings, adjust, balanceOf } = await setUp();

		const { adjustment } = await json<AdjustAccountResult>(
			await adjust(alice, wallet.id, {
				balance: 12_500,
				date: "2026-11-15",
				tagId: outings.id,
			}),
		);

		expect(adjustment).toMatchObject({
			type: "income",
			amount: 2_500,
			lines: [{ amount: 2_500, tagId: outings.id }],
		});
		expect(await balanceOf(wallet.id)).toBe(12_500);
	});

	it("records nothing when there is no gap", async () => {
		const { alice, h, wallet, adjust } = await setUp();

		expect(
			await json<AdjustAccountResult>(
				await adjust(alice, wallet.id, { balance: 10_000, date: "2026-11-15" }),
			),
		).toEqual({ adjustment: null, balance: 10_000 });
		expect((await json<{ data: unknown[] }>(await h.list(alice))).data).toEqual(
			[],
		);
	});

	it("counts the balance as it stood on the day given", async () => {
		const { alice, h, wallet, adjust } = await setUp();
		// After the day counted: not in what was expected then
		await h.created(alice, {
			type: "expense",
			accountId: wallet.id,
			date: "2026-11-20",
			lines: [{ amount: 1_000 }],
		});

		const { adjustment } = await json<AdjustAccountResult>(
			await adjust(alice, wallet.id, { balance: 9_000, date: "2026-11-15" }),
		);

		expect(adjustment).toMatchObject({ amount: 1_000, date: "2026-11-15" });
	});

	it("follows a bank's balance on an account that owes money", async () => {
		const { alice, h, adjust, balanceOf } = await setUp();
		const card = await h.account(alice, {
			name: "Visa",
			type: "credit_card",
			openingBalance: -50_000,
		});

		await adjust(alice, card.id, { balance: -52_000, date: "2026-11-15" });

		expect(await balanceOf(card.id)).toBe(-52_000);
	});

	it("is for a holder of the account, and hides it from outsiders", async () => {
		const { alice, bob, carol, h, wallet, adjust } = await setUp();
		const body = { balance: 5_000, date: "2026-11-15" };

		expect((await adjust(bob, wallet.id, body)).status).toBe(403);
		expect(
			(await adjust(bob, wallet.id, { balance: 10_000, date: "2026-11-15" }))
				.status,
		).toBe(403);
		expect((await adjust(carol, wallet.id, body)).status).toBe(404);
		await h.updateAccount(alice, wallet.id, { archived: true });
		expect((await adjust(alice, wallet.id, body)).status).toBe(409);
	});

	it("rejects a tag from elsewhere, and a day that isn't one", async () => {
		const { alice, wallet, adjust } = await setUp();

		const tag = await adjust(alice, wallet.id, {
			balance: 5_000,
			date: "2026-11-15",
			tagId: "00000000-0000-4000-8000-000000000001",
		});
		const day = await adjust(alice, wallet.id, {
			balance: 5_000,
			date: "15/11/2026",
		});

		expect(await tag.json()).toMatchObject({
			error: {
				details: [{ field: "tagId", message: "transaction_tag_invalid" }],
			},
		});
		expect(day.status).toBe(422);
	});
});
