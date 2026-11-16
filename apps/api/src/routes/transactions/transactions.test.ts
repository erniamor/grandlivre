import type { AccountsSummary, Paginated, Transaction } from "@repo/schemas";
import { api, json } from "@test/helpers/api";
import {
	addTestMember,
	createTestHousehold,
	signInUser,
} from "@test/helpers/households";
import { householdApi } from "@test/helpers/transactions";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.restoreAllMocks();
});

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

/**
 * A household owned by Alice, with Bob and Carol as plain members; Dave is
 * outside it. Alice holds a chequing account (1,000.00) that shows its
 * details; Bob holds a savings account (5,000.00) that shows only its balance.
 */
async function setUp() {
	const alice = await signInUser("alice@example.com");
	const bob = await signInUser("bob@example.com");
	const carol = await signInUser("carol@example.com");
	const dave = await signInUser("dave@example.com");
	const household = await createTestHousehold(alice.cookie);
	await addTestMember(household.id, bob.id);
	await addTestMember(household.id, carol.id);
	const h = householdApi(household.id);
	const chequing = await h.account(alice);
	const savings = await h.account(bob, {
		name: "Savings",
		type: "savings",
		visibility: "balance",
		openingBalance: 500_000,
	});
	const car = await h.tag(alice, "Car");
	const gas = await h.tag(alice, "Gas", car.id);
	const food = await h.tag(alice, "Food");

	const expense = (fields: Record<string, unknown> = {}) => ({
		type: "expense",
		accountId: chequing.id,
		date: "2026-11-14",
		lines: [{ amount: 7200, tagId: gas.id }],
		...fields,
	});
	const balanceOf = async (accountId: string) =>
		(await h.getAccount(alice, accountId)).balance;
	const idsOf = async (response: Response) =>
		(await json<Paginated<Transaction>>(response)).data.map(
			(transaction) => transaction.id,
		);

	return {
		alice,
		bob,
		carol,
		dave,
		household,
		h,
		chequing,
		savings,
		car,
		gas,
		food,
		expense,
		balanceOf,
		idsOf,
	};
}

describe("POST /v1/households/:householdId/transactions", () => {
	it("records an expense on an account the user holds, and lowers its balance", async () => {
		const { alice, household, h, chequing, gas, expense, balanceOf } =
			await setUp();

		const response = await h.create(
			alice,
			expense({ payee: " Shell ", note: " Full tank " }),
		);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({
			id: expect.any(String),
			householdId: household.id,
			type: "expense",
			date: "2026-11-14",
			accountId: chequing.id,
			toAccountId: null,
			amount: 7200,
			payee: "Shell",
			note: "Full tank",
			origin: "manual",
			receipt: null,
			lines: [{ id: expect.any(String), amount: 7200, tagId: gas.id }],
			createdBy: { userId: alice.id, name: "alice@example.com" },
			createdAt: expect.any(String),
			updatedAt: expect.any(String),
		});
		expect(await balanceOf(chequing.id)).toBe(100_000 - 7200);
	});

	it("records an income, which raises the balance, with an uncategorized line", async () => {
		const { alice, h, chequing, balanceOf } = await setUp();

		const income = await h.created(alice, {
			type: "income",
			accountId: chequing.id,
			date: "2026-11-01",
			payee: "Employer",
			lines: [{ amount: 250_000 }],
		});

		expect(income).toMatchObject({
			type: "income",
			amount: 250_000,
			lines: [{ amount: 250_000, tagId: null }],
		});
		expect(await balanceOf(chequing.id)).toBe(350_000);
	});

	it("splits an expense into lines: the amount is their sum, in entry order", async () => {
		const { alice, h, chequing, gas, food, expense, balanceOf } = await setUp();

		const split = await h.created(
			alice,
			expense({
				payee: "Costco",
				lines: [
					{ amount: 12_000, tagId: food.id },
					{ amount: 4500, tagId: gas.id },
					{ amount: 1500 },
				],
			}),
		);

		expect(split.amount).toBe(18_000);
		expect(split.lines).toMatchObject([
			{ amount: 12_000, tagId: food.id },
			{ amount: 4500, tagId: gas.id },
			{ amount: 1500, tagId: null },
		]);
		expect(await balanceOf(chequing.id)).toBe(82_000);
	});

	it("moves money with a transfer: one account goes down, the other up, the household's balance doesn't move", async () => {
		const { alice, h, chequing, savings, balanceOf } = await setUp();

		const transfer = await h.created(alice, {
			type: "transfer",
			accountId: chequing.id,
			toAccountId: savings.id,
			date: "2026-11-14",
			amount: 30_000,
			note: "Savings of the month",
		});

		expect(transfer).toMatchObject({
			type: "transfer",
			toAccountId: savings.id,
			amount: 30_000,
			payee: null,
			lines: [],
		});
		expect(await balanceOf(chequing.id)).toBe(70_000);
		expect(await balanceOf(savings.id)).toBe(530_000);
		const summary = await json<AccountsSummary>(
			await api(`${h.base}/accounts/summary`, { cookie: alice.cookie }),
		);
		expect(summary.balance).toBe(600_000);
	});

	it("counts expenses and incomes in the household's balance", async () => {
		const { alice, h, chequing, expense } = await setUp();
		await h.create(alice, expense({ lines: [{ amount: 150_000 }] }));

		const summary = await json<AccountsSummary>(
			await api(`${h.base}/accounts/summary`, { cookie: alice.cookie }),
		);

		// Chequing is overdrawn: 1,000.00 - 1,500.00
		expect(summary).toEqual({
			assets: 500_000,
			liabilities: -50_000,
			balance: 450_000,
		});
		expect((await h.getAccount(alice, chequing.id)).balance).toBe(-50_000);
	});

	it("refuses a member who doesn't hold the account, even an owner of the household", async () => {
		const { alice, carol, h, chequing, savings, expense, balanceOf } =
			await setUp();

		const onDetails = await h.create(carol, expense());
		const onBalanceOnly = await h.create(
			alice,
			expense({ accountId: savings.id }),
		);

		expect(onDetails.status).toBe(403);
		expect(onBalanceOnly.status).toBe(403);
		expect(await onDetails.json()).toMatchObject({
			error: { code: "forbidden" },
		});
		expect(await balanceOf(chequing.id)).toBe(100_000);
	});

	it("lets every holder of a shared account record on it", async () => {
		const { alice, bob, h, expense } = await setUp();
		const joint = await h.account(alice, {
			name: "Joint",
			holderIds: [alice.id, bob.id],
		});

		const byBob = await h.create(bob, expense({ accountId: joint.id }));

		expect(byBob.status).toBe(201);
		expect(await byBob.json()).toMatchObject({
			createdBy: { userId: bob.id },
		});
	});

	it("takes a holder of the account the money leaves for a transfer, not of the one it enters", async () => {
		const { alice, bob, h, chequing, savings } = await setUp();
		const transfer = (from: string, to: string) => ({
			type: "transfer",
			accountId: from,
			toAccountId: to,
			date: "2026-11-14",
			amount: 1000,
		});

		// Alice holds chequing; savings is Bob's
		const sent = await h.create(alice, transfer(chequing.id, savings.id));
		const pulled = await h.create(alice, transfer(savings.id, chequing.id));
		const byBob = await h.create(bob, transfer(savings.id, chequing.id));

		expect(sent.status).toBe(201);
		expect(pulled.status).toBe(403);
		expect(byBob.status).toBe(201);
	});

	it("refuses an account or a tag that isn't in the household", async () => {
		const { alice, dave, h, chequing, expense } = await setUp();
		const other = await createTestHousehold(dave.cookie, "The Gagnons");
		const elsewhere = householdApi(other.id);
		const foreignAccount = await elsewhere.account(dave);
		const foreignTag = await elsewhere.tag(dave, "Gas");

		const account = await h.create(
			alice,
			expense({ accountId: foreignAccount.id }),
		);
		const destination = await h.create(alice, {
			type: "transfer",
			accountId: chequing.id,
			toAccountId: UNKNOWN_ID,
			date: "2026-11-14",
			amount: 100,
		});
		const tag = await h.create(
			alice,
			expense({
				lines: [{ amount: 100 }, { amount: 200, tagId: foreignTag.id }],
			}),
		);

		const details = async (response: Response) =>
			((await response.json()) as { error: { details: unknown } }).error
				.details;
		expect(account.status).toBe(422);
		expect(await details(account)).toEqual([
			{ field: "accountId", message: "transaction_account_invalid" },
		]);
		expect(destination.status).toBe(422);
		expect(await details(destination)).toEqual([
			{ field: "toAccountId", message: "transaction_account_invalid" },
		]);
		expect(tag.status).toBe(422);
		expect(await details(tag)).toEqual([
			{ field: "lines.1.tagId", message: "transaction_tag_invalid" },
		]);
	});

	it("rejects invalid fields with error codes", async () => {
		const { alice, h, expense } = await setUp();

		const response = await h.create(
			alice,
			expense({ date: "14/11/2026", lines: [{ amount: 0 }] }),
		);

		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({
			error: {
				details: [
					{ field: "date", message: "date_invalid" },
					{ field: "lines.0.amount", message: "amount_not_positive" },
				],
			},
		});
	});

	it("keeps where a transaction comes from", async () => {
		const { alice, h, expense } = await setUp();

		const response = await h.create(alice, expense({ origin: "import" }));

		expect(response.status).toBe(201);
		expect(await response.json()).toMatchObject({ origin: "import" });
	});

	it("hides the household from outsiders and requires a session", async () => {
		const { dave, h, expense } = await setUp();

		expect((await h.create(dave, expense())).status).toBe(404);
		expect(
			(
				await api(`${h.base}/transactions`, {
					method: "POST",
					body: expense(),
				})
			).status,
		).toBe(401);
	});
});

describe("GET /v1/households/:householdId/transactions", () => {
	it("lists the most recent day first and, within a day, the last recorded first", async () => {
		const { alice, h, expense, idsOf } = await setUp();
		const old = await h.created(alice, expense({ date: "2026-10-01" }));
		const first = await h.created(alice, expense({ date: "2026-11-14" }));
		const second = await h.created(alice, expense({ date: "2026-11-14" }));

		const response = await h.list(alice);

		expect(response.status).toBe(200);
		const page = await json<Paginated<Transaction>>(response.clone());
		expect(await idsOf(response)).toEqual([second.id, first.id, old.id]);
		expect(page.pagination).toEqual({ page: 1, pageSize: 50, total: 3 });
		expect(page.data[0]?.lines).toHaveLength(1);
	});

	it("shows the transactions of an account that shows its details to every member", async () => {
		const { alice, carol, h, expense, idsOf } = await setUp();
		const transaction = await h.created(alice, expense());

		expect(await idsOf(await h.list(carol))).toEqual([transaction.id]);
	});

	it("hides the transactions of a balance-only account from those who don't hold it", async () => {
		const { alice, bob, carol, h, savings, expense, idsOf } = await setUp();
		const hidden = await h.created(bob, expense({ accountId: savings.id }));

		expect(await idsOf(await h.list(bob))).toEqual([hidden.id]);
		expect(await idsOf(await h.list(alice))).toEqual([]);
		expect(await idsOf(await h.list(carol))).toEqual([]);
		expect(
			await idsOf(await h.list(alice, `?accountId=${savings.id}`)),
		).toEqual([]);
		expect((await h.get(alice, hidden.id)).status).toBe(404);
		// The amount still counts in the balance everyone sees
		expect((await h.getAccount(alice, savings.id)).balance).toBe(492_800);
	});

	it("shows a transfer to those who see the details of either of its accounts", async () => {
		const { alice, bob, carol, h, chequing, savings, idsOf } = await setUp();
		const transfer = await h.created(alice, {
			type: "transfer",
			accountId: chequing.id,
			toAccountId: savings.id,
			date: "2026-11-14",
			amount: 1000,
		});

		for (const user of [alice, bob, carol]) {
			expect(await idsOf(await h.list(user))).toEqual([transfer.id]);
		}
		// Carol sees it through chequing, which shows its details
		expect(
			await idsOf(await h.list(carol, `?accountId=${savings.id}`)),
		).toEqual([]);
		expect(await idsOf(await h.list(bob, `?accountId=${savings.id}`))).toEqual([
			transfer.id,
		]);
	});

	it("filters by account (transfers received included), type and period", async () => {
		const { alice, h, chequing, expense, idsOf } = await setUp();
		const other = await h.account(alice, { name: "Cash", type: "cash" });
		const october = await h.created(alice, expense({ date: "2026-10-31" }));
		const november = await h.created(alice, expense({ date: "2026-11-01" }));
		const income = await h.created(alice, {
			type: "income",
			accountId: other.id,
			date: "2026-11-15",
			lines: [{ amount: 100 }],
		});
		const transfer = await h.created(alice, {
			type: "transfer",
			accountId: chequing.id,
			toAccountId: other.id,
			date: "2026-11-30",
			amount: 100,
		});

		const ids = async (query: string) => idsOf(await h.list(alice, query));
		expect(await ids(`?accountId=${other.id}`)).toEqual([
			transfer.id,
			income.id,
		]);
		expect(await ids("?type=expense")).toEqual([november.id, october.id]);
		expect(await ids("?from=2026-11-01&to=2026-11-15")).toEqual([
			income.id,
			november.id,
		]);
		expect(await ids("?to=2026-10-31")).toEqual([october.id]);
		expect(await ids(`?accountId=${chequing.id}&type=transfer`)).toEqual([
			transfer.id,
		]);
	});

	it("filters by tag, the tags under it included", async () => {
		const { alice, h, car, gas, food, expense, idsOf } = await setUp();
		const onGas = await h.created(alice, expense());
		const onCar = await h.created(
			alice,
			expense({ lines: [{ amount: 100, tagId: car.id }] }),
		);
		const split = await h.created(
			alice,
			expense({
				lines: [
					{ amount: 100, tagId: food.id },
					{ amount: 50, tagId: gas.id },
				],
			}),
		);
		await h.create(alice, expense({ lines: [{ amount: 100 }] }));

		const ids = async (tagId: string) =>
			idsOf(await h.list(alice, `?tagId=${tagId}`));
		expect(await ids(car.id)).toEqual([split.id, onCar.id, onGas.id]);
		expect(await ids(gas.id)).toEqual([split.id, onGas.id]);
		expect(await ids(food.id)).toEqual([split.id]);
	});

	it("paginates, with a page size bounded by the server, and rejects invalid filters", async () => {
		const { alice, h, expense, idsOf } = await setUp();
		const first = await h.created(alice, expense({ date: "2026-11-01" }));
		await h.create(alice, expense({ date: "2026-11-02" }));

		expect(await idsOf(await h.list(alice, "?page=2&pageSize=1"))).toEqual([
			first.id,
		]);
		for (const query of [
			"?pageSize=1000",
			"?from=yesterday",
			"?type=refund",
			"?accountId=chequing",
		]) {
			expect((await h.list(alice, query)).status).toBe(422);
		}
	});

	it("hides the household from outsiders and requires a session", async () => {
		const { dave, h } = await setUp();

		expect((await h.list(dave)).status).toBe(404);
		expect((await api(`${h.base}/transactions`)).status).toBe(401);
	});
});

describe("GET /v1/households/:householdId/transactions/:transactionId", () => {
	it("returns the transaction to those who may see it", async () => {
		const { alice, carol, h, expense } = await setUp();
		const transaction = await h.created(alice, expense());

		const response = await h.get(carol, transaction.id);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(transaction);
	});

	it("answers 404 for an unknown transaction, one of another household, and to outsiders", async () => {
		const { alice, dave, h, expense } = await setUp();
		const transaction = await h.created(alice, expense());
		const other = await createTestHousehold(dave.cookie, "The Gagnons");

		expect((await h.get(alice, UNKNOWN_ID)).status).toBe(404);
		expect((await h.get(dave, transaction.id)).status).toBe(404);
		expect(
			(await householdApi(other.id).get(dave, transaction.id)).status,
		).toBe(404);
	});
});

describe("PUT /v1/households/:householdId/transactions/:transactionId", () => {
	it("replaces the transaction: lines, amount and balance follow", async () => {
		const { alice, h, chequing, food, expense, balanceOf } = await setUp();
		const transaction = await h.created(alice, expense({ payee: "Shell" }));

		const response = await h.replace(
			alice,
			transaction.id,
			expense({
				date: "2026-11-15",
				lines: [{ amount: 5000, tagId: food.id }, { amount: 1000 }],
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			id: transaction.id,
			date: "2026-11-15",
			amount: 6000,
			// Not sent again: the transaction is replaced as a whole
			payee: null,
			lines: [
				{ amount: 5000, tagId: food.id },
				{ amount: 1000, tagId: null },
			],
			createdAt: transaction.createdAt,
		});
		expect(await balanceOf(chequing.id)).toBe(94_000);
	});

	it("can turn an expense into an income or a transfer, and move it to another account", async () => {
		const { alice, h, chequing, savings, expense, balanceOf } = await setUp();
		const cash = await h.account(alice, { name: "Cash", openingBalance: 0 });
		const transaction = await h.created(alice, expense());

		const asIncome = await json<Transaction>(
			await h.replace(alice, transaction.id, {
				...expense({ accountId: cash.id }),
				type: "income",
			}),
		);
		expect(asIncome).toMatchObject({ type: "income", accountId: cash.id });
		expect(await balanceOf(chequing.id)).toBe(100_000);
		expect(await balanceOf(cash.id)).toBe(7200);

		const asTransfer = await json<Transaction>(
			await h.replace(alice, transaction.id, {
				type: "transfer",
				accountId: cash.id,
				toAccountId: savings.id,
				date: "2026-11-14",
				amount: 2000,
			}),
		);
		expect(asTransfer).toMatchObject({
			type: "transfer",
			toAccountId: savings.id,
			lines: [],
		});
		expect(await balanceOf(cash.id)).toBe(-2000);
		expect(await balanceOf(savings.id)).toBe(502_000);
	});

	it("lets any holder of the account change a transaction, whoever recorded it", async () => {
		const { alice, bob, h, expense } = await setUp();
		const joint = await h.account(alice, {
			name: "Joint",
			holderIds: [alice.id, bob.id],
		});
		const byAlice = await h.created(alice, expense({ accountId: joint.id }));

		const response = await h.replace(
			bob,
			byAlice.id,
			expense({ accountId: joint.id, lines: [{ amount: 100 }] }),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			amount: 100,
			createdBy: { userId: alice.id },
		});
	});

	it("refuses a member who doesn't hold the account, and moving it to an account they don't hold", async () => {
		const { alice, carol, h, savings, expense } = await setUp();
		const transaction = await h.created(alice, expense());

		const byCarol = await h.replace(carol, transaction.id, expense());
		const toSavings = await h.replace(
			alice,
			transaction.id,
			expense({ accountId: savings.id }),
		);

		expect(byCarol.status).toBe(403);
		expect(toSavings.status).toBe(403);
		expect(await (await h.get(alice, transaction.id)).json()).toEqual(
			transaction,
		);
	});

	it("can't change where the transaction comes from", async () => {
		const { alice, h, expense } = await setUp();
		const transaction = await h.created(alice, expense());

		const response = await h.replace(
			alice,
			transaction.id,
			expense({ origin: "import" }),
		);

		expect(response.status).toBe(422);
	});

	it("answers 404 for an unknown transaction, and for one the user can't see", async () => {
		const { alice, bob, h, savings, expense } = await setUp();
		const hidden = await h.created(bob, expense({ accountId: savings.id }));

		expect((await h.replace(alice, UNKNOWN_ID, expense())).status).toBe(404);
		expect((await h.replace(alice, hidden.id, expense())).status).toBe(404);
	});
});

describe("DELETE /v1/households/:householdId/transactions/:transactionId", () => {
	it("lets a holder delete a transaction, which gives the balance back", async () => {
		const { alice, h, chequing, expense, balanceOf } = await setUp();
		const transaction = await h.created(alice, expense());

		const response = await h.remove(alice, transaction.id);

		expect(response.status).toBe(204);
		expect((await h.get(alice, transaction.id)).status).toBe(404);
		expect(await balanceOf(chequing.id)).toBe(100_000);
	});

	it("refuses a member who doesn't hold the account, and hides what they can't see", async () => {
		const { alice, bob, carol, dave, h, savings, expense } = await setUp();
		const visible = await h.created(alice, expense());
		const hidden = await h.created(bob, expense({ accountId: savings.id }));

		expect((await h.remove(carol, visible.id)).status).toBe(403);
		expect((await h.remove(carol, hidden.id)).status).toBe(404);
		expect((await h.remove(dave, visible.id)).status).toBe(404);
		expect((await h.remove(alice, UNKNOWN_ID)).status).toBe(404);
		expect((await h.get(alice, visible.id)).status).toBe(200);
	});
});

describe("an account that has transactions", () => {
	it("can't be deleted, only archived", async () => {
		const { alice, bob, h, chequing, savings, expense } = await setUp();
		await h.create(alice, expense());
		const remove = (accountId: string, cookie: string) =>
			api(`${h.base}/accounts/${accountId}`, { method: "DELETE", cookie });

		const refused = await remove(chequing.id, alice.cookie);

		expect(refused.status).toBe(409);
		expect(await refused.json()).toMatchObject({
			error: { code: "account_has_transactions" },
		});
		// An account that only received a transfer has transactions too
		const cash = await h.account(alice, { name: "Cash" });
		await h.create(alice, {
			type: "transfer",
			accountId: chequing.id,
			toAccountId: cash.id,
			date: "2026-11-14",
			amount: 100,
		});
		expect((await remove(cash.id, alice.cookie)).status).toBe(409);
		// Without transactions, it still goes
		expect((await remove(savings.id, bob.cookie)).status).toBe(204);
	});

	it("once archived, keeps its transactions and its place in the balance, but takes no new one", async () => {
		const { alice, h, chequing, savings, expense, balanceOf } = await setUp();
		const transaction = await h.created(alice, expense());

		const archived = await h.updateAccount(alice, chequing.id, {
			archived: true,
		});

		expect(archived.status).toBe(200);
		expect(await archived.json()).toMatchObject({
			archived: true,
			balance: 92_800,
		});
		expect((await h.get(alice, transaction.id)).status).toBe(200);
		const summary = await json<AccountsSummary>(
			await api(`${h.base}/accounts/summary`, { cookie: alice.cookie }),
		);
		expect(summary.balance).toBe(592_800);

		const refusals = await Promise.all([
			h.create(alice, expense()),
			h.replace(alice, transaction.id, expense({ lines: [{ amount: 1 }] })),
			h.remove(alice, transaction.id),
		]);
		for (const refusal of refusals) {
			expect(refusal.status).toBe(409);
			expect(await refusal.json()).toMatchObject({
				error: { code: "account_archived" },
			});
		}
		expect(await balanceOf(savings.id)).toBe(500_000);
	});

	it("refuses a transfer to an archived account, and works again once it is back", async () => {
		const { alice, bob, h, chequing, savings, expense } = await setUp();
		await h.updateAccount(bob, savings.id, { archived: true });
		const transfer = {
			type: "transfer",
			accountId: chequing.id,
			toAccountId: savings.id,
			date: "2026-11-14",
			amount: 100,
		};

		expect((await h.create(alice, transfer)).status).toBe(409);

		const back = await h.updateAccount(bob, savings.id, { archived: false });
		expect(await back.json()).toMatchObject({ archived: false });
		expect((await h.create(alice, transfer)).status).toBe(201);
		expect((await h.create(alice, expense())).status).toBe(201);
	});

	it("is archived by its holders only", async () => {
		const { carol, h, chequing } = await setUp();

		expect(
			(await h.updateAccount(carol, chequing.id, { archived: true })).status,
		).toBe(403);
	});
});

describe("a tag that has transactions", () => {
	it("can't be deleted until no line uses it", async () => {
		const { alice, h, gas, expense } = await setUp();
		const transaction = await h.created(alice, expense());
		const remove = () =>
			api(`${h.base}/tags/${gas.id}`, {
				method: "DELETE",
				cookie: alice.cookie,
			});

		const refused = await remove();
		await h.remove(alice, transaction.id);
		const accepted = await remove();

		expect(refused.status).toBe(409);
		expect(await refused.json()).toMatchObject({
			error: { code: "tag_in_use" },
		});
		expect(accepted.status).toBe(204);
	});
});

describe("a member who leaves the household", () => {
	it("leaves their transactions behind, with their name", async () => {
		const { alice, bob, h, expense } = await setUp();
		const joint = await h.account(alice, {
			name: "Joint",
			holderIds: [alice.id, bob.id],
		});
		const byBob = await h.created(bob, expense({ accountId: joint.id }));

		await api(`${h.base}/members/${bob.id}`, {
			method: "DELETE",
			cookie: bob.cookie,
		});

		expect(await (await h.get(alice, byBob.id)).json()).toMatchObject({
			amount: 7200,
			createdBy: { userId: bob.id, name: "bob@example.com" },
		});
	});
});
