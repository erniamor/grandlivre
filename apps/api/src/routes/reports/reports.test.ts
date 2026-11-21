import type { MonthlyReport, TagReport, TagTotal } from "@repo/schemas";
import { api, json } from "@test/helpers/api";
import {
	addTestMember,
	createTestHousehold,
	signInUser,
	type TestUser,
} from "@test/helpers/households";
import { householdApi } from "@test/helpers/transactions";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.restoreAllMocks();
});

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

/**
 * A household owned by Alice, with Bob as a plain member; Carol is outside
 * it. Alice holds a chequing account that shows its details; Bob holds a
 * card that shows only its balance. Tags: Car › Gas, and Food.
 *
 * In November 2026:
 * - Costco on chequing, split: 120.00 Food, 45.00 Gas, 15.00 uncategorized
 * - Shell on chequing: 72.00 Gas
 * - a refund on chequing, an income: 30.00 Food
 * - the salary on chequing, uncategorized: 2,500.00
 * - a transfer from chequing to the card: 300.00, in no report
 * - Bob's restaurant on his card: 60.00 Food
 * In October 2026: a car repair on chequing, 400.00 Car.
 */
async function setUp() {
	const alice = await signInUser("alice@example.com");
	const bob = await signInUser("bob@example.com");
	const carol = await signInUser("carol@example.com");
	const household = await createTestHousehold(alice.cookie);
	await addTestMember(household.id, bob.id);
	const h = householdApi(household.id);
	const chequing = await h.account(alice);
	const card = await h.account(bob, {
		name: "Bob's Visa",
		type: "credit_card",
		visibility: "balance",
		openingBalance: 0,
	});
	const car = await h.tag(alice, "Car");
	const gas = await h.tag(alice, "Gas", car.id);
	const food = await h.tag(alice, "Food");

	const record = (
		user: TestUser,
		type: "expense" | "income",
		accountId: string,
		date: string,
		lines: { amount: number; tagId?: string }[],
	) => h.created(user, { type, accountId, date, lines });
	await record(alice, "expense", chequing.id, "2026-11-03", [
		{ amount: 12_000, tagId: food.id },
		{ amount: 4500, tagId: gas.id },
		{ amount: 1500 },
	]);
	await record(alice, "expense", chequing.id, "2026-11-14", [
		{ amount: 7200, tagId: gas.id },
	]);
	await record(alice, "income", chequing.id, "2026-11-20", [
		{ amount: 3000, tagId: food.id },
	]);
	await record(alice, "income", chequing.id, "2026-11-01", [
		{ amount: 250_000 },
	]);
	await h.created(alice, {
		type: "transfer",
		accountId: chequing.id,
		toAccountId: card.id,
		date: "2026-11-15",
		amount: 30_000,
	});
	await record(bob, "expense", card.id, "2026-11-30", [
		{ amount: 6000, tagId: food.id },
	]);
	await record(alice, "expense", chequing.id, "2026-10-31", [
		{ amount: 40_000, tagId: car.id },
	]);

	const report = (user: TestUser, path: string, query: string) =>
		api(`${h.base}/reports/${path}?${query}`, { cookie: user.cookie });

	return {
		alice,
		bob,
		carol,
		household,
		h,
		chequing,
		card,
		car,
		gas,
		food,
		report,
	};
}

/** The months of a report, without their detail by tag. */
function totals(report: MonthlyReport) {
	return report.months.map(({ month, expense, income }) => ({
		month,
		expense,
		income,
	}));
}

/** The tags of a report, sorted for comparison; null for the uncategorized. */
function byTag(report: TagReport) {
	return Object.fromEntries(
		report.tags.map(({ tagId, expense, income }: TagTotal) => [
			String(tagId),
			{ expense, income },
		]),
	);
}

describe("GET /v1/households/:householdId/reports/tags", () => {
	it("gathers each tag's own lines over the period, expenses and incomes apart", async () => {
		const { alice, gas, food, report } = await setUp();

		const response = await report(
			alice,
			"tags",
			"from=2026-11-01&to=2026-11-30",
		);

		expect(response.status).toBe(200);
		const result = await json<TagReport>(response);
		expect(result.from).toBe("2026-11-01");
		expect(result.to).toBe("2026-11-30");
		expect(byTag(result)).toEqual({
			// Costco's share, Bob's restaurant; the refund apart
			[food.id]: { expense: 18_000, income: 3000 },
			// Costco's share and Shell
			[gas.id]: { expense: 11_700, income: 0 },
			// Costco's uncategorized share, the salary
			null: { expense: 1500, income: 250_000 },
		});
	});

	it("keeps the uncategorized lines set aside as undetermined apart from those to categorize", async () => {
		const { alice, chequing, h, report } = await setUp();
		const repair = await h.created(alice, {
			type: "expense",
			accountId: chequing.id,
			date: "2026-11-10",
			lines: [{ amount: 8000 }],
		});
		await h.replace(alice, repair.id, {
			type: "expense",
			accountId: chequing.id,
			date: "2026-11-10",
			lines: [{ amount: 8000 }],
			undetermined: true,
		});

		const uncategorized = (result: { tags: TagTotal[] }) =>
			result.tags
				.filter((each) => each.tagId === null)
				.sort((a, b) => Number(a.undetermined) - Number(b.undetermined));
		const expected = [
			// Costco's uncategorized share, the salary
			{ tagId: null, undetermined: false, expense: 1500, income: 250_000 },
			{ tagId: null, undetermined: true, expense: 8000, income: 0 },
		];
		expect(
			uncategorized(
				await json<TagReport>(
					await report(alice, "tags", "from=2026-11-01&to=2026-11-30"),
				),
			),
		).toEqual(expected);
		const monthly = await json<MonthlyReport>(
			await report(alice, "monthly", "from=2026-11-01&to=2026-11-30"),
		);
		expect(uncategorized({ tags: monthly.months[0]?.tags ?? [] })).toEqual(
			expected,
		);
		// A tag's lines are never undetermined
		expect(
			monthly.months[0]?.tags.filter(
				(each) => each.tagId !== null && each.undetermined,
			),
		).toEqual([]);
	});

	it("keeps to each tag's own lines: those of the tags under it aren't added", async () => {
		const { alice, car, report } = await setUp();

		const result = await json<TagReport>(
			await report(alice, "tags", "from=2026-10-01&to=2026-11-30"),
		);

		// The repair, and not Gas's lines
		expect(byTag(result)[car.id]).toEqual({ expense: 40_000, income: 0 });
	});

	it("counts the accounts that only show their balance, for every member", async () => {
		const { alice, bob, food, report } = await setUp();

		for (const user of [alice, bob]) {
			const result = await json<TagReport>(
				await report(user, "tags", "from=2026-11-30&to=2026-11-30"),
			);
			expect(byTag(result)).toEqual({
				[food.id]: { expense: 6000, income: 0 },
			});
		}
	});

	it("leaves transfers out, and the days outside the period, bounds included", async () => {
		const { alice, gas, report } = await setUp();

		const lastDay = await json<TagReport>(
			await report(alice, "tags", "from=2026-11-14&to=2026-11-15"),
		);
		const before = await json<TagReport>(
			await report(alice, "tags", "from=2026-01-01&to=2026-10-30"),
		);

		// Shell on the 14th; the transfer on the 15th counts nowhere
		expect(byTag(lastDay)).toEqual({ [gas.id]: { expense: 7200, income: 0 } });
		expect(before.tags).toEqual([]);
	});

	it("narrows to an account whose details the user may see", async () => {
		const { alice, bob, chequing, card, food, report } = await setUp();

		const onChequing = await json<TagReport>(
			await report(
				alice,
				"tags",
				`from=2026-11-01&to=2026-11-30&accountId=${chequing.id}`,
			),
		);
		const onOwnCard = await json<TagReport>(
			await report(
				bob,
				"tags",
				`from=2026-11-01&to=2026-11-30&accountId=${card.id}`,
			),
		);

		expect(byTag(onChequing)[food.id]).toEqual({
			expense: 12_000,
			income: 3000,
		});
		expect(byTag(onOwnCard)).toEqual({
			[food.id]: { expense: 6000, income: 0 },
		});
	});

	it("refuses to narrow to an account that only shows its balance to the user", async () => {
		const { alice, card, report } = await setUp();

		const response = await report(
			alice,
			"tags",
			`from=2026-11-01&to=2026-11-30&accountId=${card.id}`,
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({
			error: { code: "forbidden" },
		});
	});

	it("refuses an account outside the household, and an invalid period", async () => {
		const { alice, report } = await setUp();
		const details = async (query: string) => {
			const response = await report(alice, "tags", query);
			return { status: response.status, body: await response.json() };
		};

		expect(
			await details(`from=2026-11-01&to=2026-11-30&accountId=${UNKNOWN_ID}`),
		).toMatchObject({
			status: 422,
			body: {
				error: {
					details: [
						{ field: "accountId", message: "transaction_account_invalid" },
					],
				},
			},
		});
		expect(await details("from=2026-11-30&to=2026-11-01")).toMatchObject({
			status: 422,
			body: {
				error: { details: [{ field: "to", message: "report_period_invalid" }] },
			},
		});
		for (const query of [
			"to=2026-11-30",
			"from=2026-11-01",
			"from=2026-02-30&to=2026-03-01",
		]) {
			expect((await details(query)).status).toBe(422);
		}
	});

	it("hides the household from outsiders and requires a session", async () => {
		const { carol, h, report } = await setUp();

		expect(
			(await report(carol, "tags", "from=2026-11-01&to=2026-11-30")).status,
		).toBe(404);
		expect(
			(await api(`${h.base}/reports/tags?from=2026-11-01&to=2026-11-30`))
				.status,
		).toBe(401);
	});
});

describe("GET /v1/households/:householdId/reports/monthly", () => {
	it("gives every month of the period, empty ones included", async () => {
		const { alice, report } = await setUp();

		const response = await report(
			alice,
			"monthly",
			"from=2026-09-01&to=2027-01-31",
		);

		expect(response.status).toBe(200);
		expect(totals(await json<MonthlyReport>(response))).toEqual([
			{ month: "2026-09", expense: 0, income: 0 },
			{ month: "2026-10", expense: 40_000, income: 0 },
			// 180.00 + 72.00 + 60.00; 30.00 + 2,500.00; not the transfer
			{ month: "2026-11", expense: 31_200, income: 253_000 },
			{ month: "2026-12", expense: 0, income: 0 },
			{ month: "2027-01", expense: 0, income: 0 },
		]);
	});

	it("keeps to the days of the period inside its first and last months", async () => {
		const { alice, report } = await setUp();

		const result = await json<MonthlyReport>(
			await report(alice, "monthly", "from=2026-10-31&to=2026-11-14"),
		);

		// The repair on the 31st; Costco and Shell, the salary; not the 20th nor the 30th
		expect(totals(result)).toEqual([
			{ month: "2026-10", expense: 40_000, income: 0 },
			{ month: "2026-11", expense: 18_000 + 7200, income: 250_000 },
		]);
	});

	it("details each month tag by tag, as the report by tag does", async () => {
		const { alice, gas, food, car, report } = await setUp();

		const result = await json<MonthlyReport>(
			await report(alice, "monthly", "from=2026-10-01&to=2026-11-30"),
		);
		const tagsOf = (month: string) =>
			Object.fromEntries(
				(result.months.find((each) => each.month === month)?.tags ?? []).map(
					({ tagId, expense, income }) => [String(tagId), { expense, income }],
				),
			);

		expect(tagsOf("2026-10")).toEqual({
			[car.id]: { expense: 40_000, income: 0 },
		});
		expect(tagsOf("2026-11")).toEqual({
			[food.id]: { expense: 18_000, income: 3000 },
			[gas.id]: { expense: 11_700, income: 0 },
			null: { expense: 1500, income: 250_000 },
		});
	});

	it("narrows to a tag, the tags under it included", async () => {
		const { alice, car, food, report } = await setUp();
		const months = async (tagId: string) =>
			totals(
				await json<MonthlyReport>(
					await report(
						alice,
						"monthly",
						`from=2026-10-01&to=2026-11-30&tagId=${tagId}`,
					),
				),
			);

		expect(await months(car.id)).toEqual([
			{ month: "2026-10", expense: 40_000, income: 0 },
			// Gas: Costco's share and Shell
			{ month: "2026-11", expense: 11_700, income: 0 },
		]);
		expect(await months(food.id)).toEqual([
			{ month: "2026-10", expense: 0, income: 0 },
			{ month: "2026-11", expense: 18_000, income: 3000 },
		]);
	});

	it("narrows to an account whose details the user may see, and refuses the others", async () => {
		const { alice, chequing, card, report } = await setUp();

		const onChequing = await json<MonthlyReport>(
			await report(
				alice,
				"monthly",
				`from=2026-11-01&to=2026-11-30&accountId=${chequing.id}`,
			),
		);
		const onCard = await report(
			alice,
			"monthly",
			`from=2026-11-01&to=2026-11-30&accountId=${card.id}`,
		);

		expect(totals(onChequing)).toEqual([
			{ month: "2026-11", expense: 25_200, income: 253_000 },
		]);
		expect(onCard.status).toBe(403);
	});

	it("refuses a tag outside the household, and a period over five years", async () => {
		const { alice, report } = await setUp();

		const tag = await report(
			alice,
			"monthly",
			`from=2026-11-01&to=2026-11-30&tagId=${UNKNOWN_ID}`,
		);
		const tooLong = await report(
			alice,
			"monthly",
			"from=2022-01-01&to=2027-01-31",
		);
		const longest = await report(
			alice,
			"monthly",
			"from=2022-01-01&to=2026-12-31",
		);

		expect(tag.status).toBe(422);
		expect(await tag.json()).toMatchObject({
			error: {
				details: [{ field: "tagId", message: "transaction_tag_invalid" }],
			},
		});
		expect(tooLong.status).toBe(422);
		expect(await tooLong.json()).toMatchObject({
			error: {
				details: [{ field: "from", message: "report_period_too_long" }],
			},
		});
		expect(longest.status).toBe(200);
		expect((await json<MonthlyReport>(longest)).months).toHaveLength(60);
	});

	it("hides the household from outsiders and requires a session", async () => {
		const { carol, h, report } = await setUp();

		expect(
			(await report(carol, "monthly", "from=2026-11-01&to=2026-11-30")).status,
		).toBe(404);
		expect(
			(await api(`${h.base}/reports/monthly?from=2026-11-01&to=2026-11-30`))
				.status,
		).toBe(401);
	});
});
