import type {
	CategorizeResult,
	Paginated,
	Transaction,
	UncategorizedCount,
	UncategorizedPayee,
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

/**
 * Alice's account, with expenses without a tag at Costco (two spellings),
 * one at Costco already tagged, a refund from Costco, one without a payee
 * and one at SAAQ; Bob's account, with a Costco expense of his own.
 */
async function setUp() {
	const alice = await signInUser("alice@example.com");
	const bob = await signInUser("bob@example.com");
	const carol = await signInUser("carol@example.com");
	const household = await createTestHousehold(alice.cookie);
	await addTestMember(household.id, bob.id);
	const h = householdApi(household.id);
	const chequing = await h.account(alice);
	const bobs = await h.account(bob, { name: "Bob's" });
	const fuel = await h.tag(alice, "Fuel");
	const expense = (
		user: TestUser,
		accountId: string,
		payee: string | undefined,
		amount: number,
		date: string,
		tagId?: string,
	) =>
		h.created(user, {
			type: "expense",
			accountId,
			date,
			payee,
			lines: [{ amount, tagId }],
		});
	const w100 = await expense(
		alice,
		chequing.id,
		"COSTCO ESSENCE W100",
		60_00,
		"2026-10-01",
	);
	const w1234 = await expense(
		alice,
		chequing.id,
		"COSTCO ESSENCE W1234",
		40_00,
		"2026-10-20",
	);
	const tagged = await expense(
		alice,
		chequing.id,
		"COSTCO ESSENCE W100",
		50_00,
		"2026-10-10",
		fuel.id,
	);
	const refund = await h.created(alice, {
		type: "income",
		accountId: chequing.id,
		date: "2026-10-25",
		payee: "Costco essence W100",
		lines: [{ amount: 5_00 }],
	});
	const noPayee = await expense(
		alice,
		chequing.id,
		undefined,
		9_00,
		"2026-10-05",
	);
	const saaq = await expense(alice, chequing.id, "SAAQ", 350_86, "2026-10-15");
	const bobsCostco = await expense(
		bob,
		bobs.id,
		"COSTCO ESSENCE W100",
		70_00,
		"2026-10-12",
	);
	const setAside = (user: TestUser | undefined, body: unknown) =>
		api(`${h.base}/transactions/uncategorized/set-aside`, {
			method: "POST",
			cookie: user?.cookie,
			body,
		});
	const countBefore = (user: TestUser | undefined, before: string) =>
		api(`${h.base}/transactions/uncategorized/count?before=${before}`, {
			cookie: user?.cookie,
		});
	const payees = async (user: TestUser) =>
		(
			await json<Paginated<UncategorizedPayee>>(
				await api(`${h.base}/transactions/uncategorized`, {
					cookie: user.cookie,
				}),
			)
		).data.map((each) => `${each.type}:${each.key}:${each.count}`);
	const read = async (user: TestUser, id: string) =>
		json<Transaction>(await h.get(user, id));
	const ids = async (user: TestUser, query: string) =>
		(await json<Paginated<Transaction>>(await h.list(user, query))).data
			.map((each) => each.id)
			.sort();
	return {
		alice,
		bob,
		carol,
		h,
		chequing,
		fuel,
		w100,
		w1234,
		tagged,
		refund,
		noPayee,
		saaq,
		bobsCostco,
		expense,
		setAside,
		countBefore,
		payees,
		read,
		ids,
	};
}

describe("POST /v1/households/:householdId/transactions/uncategorized/set-aside", () => {
	it("sets aside a payee's expenses without a tag, on the member's accounts only", async () => {
		const {
			alice,
			bob,
			w100,
			w1234,
			tagged,
			refund,
			bobsCostco,
			setAside,
			payees,
			read,
		} = await setUp();

		const response = await setAside(alice, {
			by: "payee",
			key: "costcoessencew",
			type: "expense",
		});

		expect(response.status).toBe(200);
		expect(await json<CategorizeResult>(response)).toEqual({ count: 2 });
		for (const id of [w100.id, w1234.id]) {
			const transaction = await read(alice, id);
			expect(transaction.undetermined).toBe(true);
			// Not a tag: the lines stay without one
			expect(transaction.lines[0]?.tagId).toBeNull();
		}
		// The tagged one, the refund (an income) and Bob's: as they were
		expect((await read(alice, tagged.id)).undetermined).toBe(false);
		expect((await read(alice, refund.id)).undetermined).toBe(false);
		expect((await read(bob, bobsCostco.id)).undetermined).toBe(false);
		// They leave the ones to categorize
		expect(await payees(alice)).toEqual([
			"expense:saaq:1",
			"income:costcoessencew:1",
		]);
	});

	it("leaves the payee's next expenses to categorize, and a tag for the payee leaves them aside", async () => {
		const { alice, chequing, fuel, w100, expense, setAside, payees, read, h } =
			await setUp();
		await setAside(alice, {
			by: "payee",
			key: "costcoessencew",
			type: "expense",
		});

		const next = await expense(
			alice,
			chequing.id,
			"COSTCO ESSENCE W100",
			55_00,
			"2026-11-02",
		);

		expect(next.undetermined).toBe(false);
		expect(await payees(alice)).toContain("expense:costcoessencew:1");
		const categorized = await json<CategorizeResult>(
			await api(`${h.base}/transactions/categorize`, {
				method: "POST",
				cookie: alice.cookie,
				body: { key: "costcoessencew", type: "expense", tagId: fuel.id },
			}),
		);
		expect(categorized).toEqual({ count: 1 });
		expect((await read(alice, next.id)).lines[0]?.tagId).toBe(fuel.id);
		expect((await read(alice, w100.id)).lines[0]?.tagId).toBeNull();
	});

	it("sets aside everything without a tag before a day, excluded, the count told first", async () => {
		const {
			alice,
			w100,
			noPayee,
			w1234,
			saaq,
			refund,
			setAside,
			countBefore,
			read,
		} = await setUp();

		const counted = await countBefore(alice, "2026-10-15");
		expect(counted.status).toBe(200);
		// W100 on the 1st, the one without a payee on the 5th; not SAAQ on the 15th
		expect(await json<UncategorizedCount>(counted)).toEqual({ count: 2 });

		expect(
			await json<CategorizeResult>(
				await setAside(alice, { by: "before", date: "2026-10-15" }),
			),
		).toEqual({ count: 2 });
		for (const id of [w100.id, noPayee.id]) {
			expect((await read(alice, id)).undetermined).toBe(true);
		}
		for (const id of [saaq.id, w1234.id, refund.id]) {
			expect((await read(alice, id)).undetermined).toBe(false);
		}
		expect(
			await json<UncategorizedCount>(await countBefore(alice, "2026-10-15")),
		).toEqual({ count: 0 });
	});

	it("refuses an invalid request, hides the household from outsiders and requires a session", async () => {
		const { alice, carol, setAside, countBefore } = await setUp();
		const body = { by: "before", date: "2026-10-15" };

		expect(
			(await setAside(alice, { by: "payee", key: "", type: "expense" })).status,
		).toBe(422);
		expect((await setAside(alice, { by: "everything" })).status).toBe(422);
		expect((await setAside(alice, { by: "before", date: "soon" })).status).toBe(
			422,
		);
		expect((await countBefore(alice, "soon")).status).toBe(422);
		expect((await setAside(carol, body)).status).toBe(404);
		expect((await countBefore(carol, "2026-10-15")).status).toBe(404);
		expect((await setAside(undefined, body)).status).toBe(401);
		expect((await countBefore(undefined, "2026-10-15")).status).toBe(401);
	});
});

describe("PUT /v1/households/:householdId/transactions/:transactionId", () => {
	it("sets a transaction aside, keeps it so when not said, and puts it back to categorize", async () => {
		const { alice, chequing, saaq, h, read } = await setUp();
		const body = {
			type: "expense",
			accountId: chequing.id,
			date: "2026-10-15",
			payee: "SAAQ",
			lines: [{ amount: 350_86 }],
		};

		const response = await h.replace(alice, saaq.id, {
			...body,
			undetermined: true,
		});
		expect(response.status).toBe(200);
		expect((await json<Transaction>(response)).undetermined).toBe(true);

		await h.replace(alice, saaq.id, { ...body, note: "Licence" });
		expect((await read(alice, saaq.id)).undetermined).toBe(true);

		await h.replace(alice, saaq.id, { ...body, undetermined: false });
		expect((await read(alice, saaq.id)).undetermined).toBe(false);
	});

	it("clears it when a line takes a tag, and refuses it with a tag or on a transfer", async () => {
		const { alice, chequing, fuel, saaq, h, read } = await setUp();
		const body = {
			type: "expense",
			accountId: chequing.id,
			date: "2026-10-15",
			payee: "SAAQ",
			lines: [{ amount: 350_86 }],
		};
		await h.replace(alice, saaq.id, { ...body, undetermined: true });

		await h.replace(alice, saaq.id, {
			...body,
			lines: [{ amount: 350_86, tagId: fuel.id }],
		});
		expect((await read(alice, saaq.id)).undetermined).toBe(false);

		const tagged = await h.replace(alice, saaq.id, {
			...body,
			lines: [{ amount: 350_86, tagId: fuel.id }],
			undetermined: true,
		});
		expect(tagged.status).toBe(422);
		expect(await tagged.json()).toMatchObject({
			error: {
				details: [
					{ field: "undetermined", message: "transaction_undetermined_tagged" },
				],
			},
		});
		const savings = await h.account(alice, {
			name: "Savings",
			type: "savings",
		});
		const transfer = await h.replace(alice, saaq.id, {
			type: "transfer",
			accountId: chequing.id,
			toAccountId: savings.id,
			date: "2026-10-15",
			amount: 350_86,
			undetermined: true,
		});
		expect(transfer.status).toBe(422);
	});
});

describe("GET /v1/households/:householdId/transactions?untagged=", () => {
	it("lists those still to categorize, or those set aside, apart", async () => {
		const {
			alice,
			w100,
			w1234,
			refund,
			noPayee,
			saaq,
			bobsCostco,
			setAside,
			ids,
		} = await setUp();
		await setAside(alice, {
			by: "payee",
			key: "costcoessencew",
			type: "expense",
		});

		expect(await ids(alice, "?untagged=undetermined")).toEqual(
			[w100.id, w1234.id].sort(),
		);
		// Bob's account shows its details: his is listed too; not the tagged one
		expect(await ids(alice, "?untagged=to-define")).toEqual(
			[refund.id, noPayee.id, saaq.id, bobsCostco.id].sort(),
		);
	});

	it("refuses an unknown value", async () => {
		const { alice, h } = await setUp();

		expect((await h.list(alice, "?untagged=maybe")).status).toBe(422);
	});
});
