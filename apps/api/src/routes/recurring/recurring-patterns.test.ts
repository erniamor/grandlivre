import { describe, expect, it } from "vitest";
import {
	findRecurringPatterns,
	type PastTransaction,
} from "@/routes/recurring/recurring-patterns";
import { addDays, occurrenceAt } from "@/routes/recurring/schedule";

const TODAY = "2026-11-16";

let sequence = 0;

function past(
	date: string,
	amount: number,
	payee: string | null,
	overrides: Partial<PastTransaction> = {},
): PastTransaction {
	sequence += 1;
	return {
		id: `t${String(sequence).padStart(4, "0")}`,
		type: "expense",
		accountId: "chequing",
		toAccountId: null,
		payee,
		amount,
		date,
		tagId: null,
		...overrides,
	};
}

/** `count` days of a monthly schedule from `start`, each moved by `shifts[i]` days. */
function monthlyDays(start: string, count: number, shifts: number[] = []) {
	return Array.from({ length: count }, (_, index) =>
		addDays(
			occurrenceAt({ unit: "month", interval: 1, startDate: start }, index),
			shifts[index] ?? 0,
		),
	);
}

describe("findRecurringPatterns", () => {
	it("finds a mortgage paid on the 1st, its days moved by weekends, as a steady monthly series", () => {
		const history = monthlyDays("2025-06-01", 18, [0, 2, 0, 1, 0, 0, 2]).map(
			(date) =>
				past(date, 1_450_00, "HYPOTHEQUE DESJARDINS 0123", { tagId: "home" }),
		);

		const [mortgage, ...others] = findRecurringPatterns(history, {
			today: TODAY,
		});

		expect(others).toEqual([]);
		expect(mortgage).toMatchObject({
			accountId: "chequing",
			type: "expense",
			key: "hypothequedesjardins",
			payee: "HYPOTHEQUE DESJARDINS 0123",
			unit: "month",
			interval: 1,
			amount: 1_450_00,
			mode: "automatic",
			nextDate: "2026-12-01",
			tagId: "home",
		});
		expect(mortgage?.dates).toHaveLength(18);
	});

	it("splits a pay on the 15th and on the 30th into two monthly series", () => {
		const fifteenth = monthlyDays("2025-11-15", 12);
		// The 30th, or the last day of February
		const thirtieth = monthlyDays("2025-11-30", 12);
		const history = [...fifteenth, ...thirtieth].map((date) =>
			past(date, 2_150_00, "PAIE EMPLOYEUR", { type: "income" }),
		);

		const patterns = findRecurringPatterns(history, { today: TODAY });

		expect(
			patterns.map(({ unit, nextDate, dates }) => ({
				unit,
				nextDate,
				count: dates.length,
			})),
		).toEqual([
			{ unit: "month", nextDate: "2026-11-30", count: 12 },
			{ unit: "month", nextDate: "2026-12-15", count: 12 },
		]);
	});

	it("offers a bill whose amount changes to be confirmed, at its median, with its range", () => {
		const amounts = [182_40, 165_10, 140_00, 98_75, 102_30, 155_90];
		const history = monthlyDays("2026-05-20", 6).map((date, index) =>
			past(date, amounts[index] as number, "HYDRO-QUEBEC"),
		);

		const [bill] = findRecurringPatterns(history, { today: TODAY });

		expect(bill).toMatchObject({
			mode: "confirm",
			amount: 147_95,
			minAmount: 98_75,
			maxAmount: 182_40,
			nextDate: "2026-11-20",
		});
	});

	it("records on its own a subscription whose price went up, at its new price", () => {
		const history = monthlyDays("2026-01-08", 11).map((date, index) =>
			past(date, index < 6 ? 16_99 : 18_99, "NETFLIX.COM"),
		);

		const [subscription] = findRecurringPatterns(history, { today: TODAY });

		expect(subscription).toMatchObject({
			mode: "automatic",
			amount: 18_99,
			minAmount: 16_99,
			maxAmount: 18_99,
		});
	});

	it("tells weekly from every two weeks", () => {
		const weekly = Array.from({ length: 10 }, (_, index) =>
			past(addDays("2026-09-11", 7 * index), 25_00, "GARDERIE"),
		);
		const biweekly = Array.from({ length: 12 }, (_, index) =>
			past(addDays("2026-06-05", 14 * index), 1_980_00, "PAIE CONJOINT", {
				type: "income",
			}),
		);

		const patterns = findRecurringPatterns([...weekly, ...biweekly], {
			today: TODAY,
		});

		expect(
			patterns
				.map(({ key, unit, interval, nextDate }) => ({
					key,
					unit,
					interval,
					nextDate,
				}))
				.sort((a, b) => a.key.localeCompare(b.key)),
		).toEqual([
			{ key: "garderie", unit: "week", interval: 1, nextDate: "2026-11-20" },
			{
				key: "paieconjoint",
				unit: "week",
				interval: 2,
				nextDate: "2026-11-20",
			},
		]);
	});

	it("finds a yearly insurance from two years", () => {
		const history = [
			past("2025-03-14", 1_210_00, "PROMUTUEL ASSURANCE"),
			past("2026-03-16", 1_264_00, "PROMUTUEL ASSURANCE"),
		];

		const [insurance] = findRecurringPatterns(history, { today: TODAY });

		expect(insurance).toMatchObject({
			unit: "year",
			interval: 1,
			mode: "confirm",
			nextDate: "2027-03-16",
		});
	});

	it("records on its own a yearly renewal of the same amount", () => {
		const history = [
			past("2025-10-01", 149_47, "COSTCO *ANNUAL RENEWAL"),
			past("2026-10-01", 149_47, "COSTCO *ANNUAL RENEWAL"),
		];

		const [renewal] = findRecurringPatterns(history, { today: TODAY });

		expect(renewal).toMatchObject({ mode: "automatic", amount: 149_47 });
	});

	it("offers nothing yearly for two amounts far apart", () => {
		const history = [
			past("2025-10-15", 72_00, "PAYSAGISTE EXEMPLE"),
			past("2026-10-19", 630_20, "PAYSAGISTE EXEMPLE"),
		];

		expect(findRecurringPatterns(history, { today: TODAY })).toEqual([]);
	});

	it("needs more months for an amount that varies a lot", () => {
		const amounts = [10_68, 18_37, 13_40, 15_20];
		const series = (count: number) =>
			monthlyDays("2026-08-07", count).map((date, index) =>
				past(date, amounts[index] as number, `RESTO ${count}`),
			);

		const patterns = findRecurringPatterns([...series(3), ...series(4)], {
			today: TODAY,
		});

		expect(patterns.map(({ payee }) => payee)).toEqual(["RESTO 4"]);
	});

	it("makes two series of two phone lines billed the same day", () => {
		const history = monthlyDays("2026-01-15", 10).flatMap((date) => [
			past(date, 41_00, "TELECOM EXEMPLE"),
			past(date, 27_50, "TELECOM EXEMPLE"),
		]);

		const patterns = findRecurringPatterns(history, { today: TODAY });

		expect(
			patterns.map(({ minAmount, maxAmount }) => [minAmount, maxAmount]),
		).toEqual([
			[41_00, 41_00],
			[27_50, 27_50],
		]);
	});

	it("offers nothing for a payee visited often but not on a schedule", () => {
		const days = [
			"2026-08-02",
			"2026-08-05",
			"2026-08-13",
			"2026-08-14",
			"2026-08-27",
			"2026-09-04",
			"2026-09-21",
			"2026-09-23",
			"2026-10-09",
			"2026-10-30",
			"2026-11-03",
			"2026-11-12",
		];
		const history = days.map((date, index) =>
			past(date, 40_00 + index * 7_13, "IGA EXTRA"),
		);

		expect(findRecurringPatterns(history, { today: TODAY })).toEqual([]);
	});

	it("offers nothing for a series that stopped", () => {
		const history = monthlyDays("2025-10-03", 8).map((date) =>
			past(date, 59_99, "GYM"),
		);

		expect(findRecurringPatterns(history, { today: TODAY })).toEqual([]);
	});

	it("offers nothing with two months only", () => {
		const history = monthlyDays("2026-09-25", 2).map((date) =>
			past(date, 12_00, "SPOTIFY"),
		);

		expect(findRecurringPatterns(history, { today: TODAY })).toEqual([]);
	});

	it("keeps a series through a month without its transaction", () => {
		const days = monthlyDays("2026-01-10", 11).filter(
			(date) => date !== "2026-06-10",
		);
		const history = days.map((date) => past(date, 35_00, "VIDEOTRON"));

		const [series] = findRecurringPatterns(history, { today: TODAY });

		expect(series?.dates).toHaveLength(10);
	});

	it("keeps payees, accounts and types apart, and skips what is covered", () => {
		const days = monthlyDays("2026-04-05", 8);
		const history = [
			...days.map((date) => past(date, 50_00, "Bell")),
			...days.map((date) => past(date, 50_00, "Bell", { accountId: "joint" })),
			...days.map((date) => past(date, 50_00, "Bell", { type: "income" })),
		];

		const patterns = findRecurringPatterns(history, {
			today: TODAY,
			covered: [
				{ accountId: "joint", toAccountId: null, type: "expense", key: "bell" },
			],
		});

		expect(
			patterns.map(({ accountId, type }) => `${accountId} ${type}`).sort(),
		).toEqual(["chequing expense", "chequing income"]);
	});

	it("finds a monthly transfer to savings by its accounts, without a payee", () => {
		const history = monthlyDays("2026-03-02", 9).map((date) =>
			past(date, 200_00, null, { type: "transfer", toAccountId: "savings" }),
		);

		const [transfer] = findRecurringPatterns(history, { today: TODAY });

		expect(transfer).toMatchObject({
			type: "transfer",
			toAccountId: "savings",
			key: "",
			nextDate: "2026-12-02",
		});
	});

	it("leaves out an expense without a payee", () => {
		const history = monthlyDays("2026-03-02", 9).map((date) =>
			past(date, 20_00, null),
		);

		expect(findRecurringPatterns(history, { today: TODAY })).toEqual([]);
	});

	it("gives the tag the series is most often given", () => {
		const tags = ["phone", "phone", null, "internet", "phone"];
		const history = monthlyDays("2026-07-12", 5).map((date, index) =>
			past(date, 80_00, "TELECOM EXEMPLE", { tagId: tags[index] ?? null }),
		);

		const [series] = findRecurringPatterns(history, { today: TODAY });

		expect(series?.tagId).toBe("phone");
	});
});
