import { describe, expect, it } from "vitest";
import { createRecurringTransactionSchema } from "./recurring.schema";
import { createTransactionSchema } from "./transaction.schema";

const ACCOUNT = "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f";

const rent = {
	transaction: {
		type: "expense",
		accountId: ACCOUNT,
		lines: [{ amount: 150_000 }],
	},
	schedule: {
		unit: "month",
		interval: 1,
		startDate: "2026-12-01",
		endDate: null,
	},
};

const issues = (input: unknown) =>
	createRecurringTransactionSchema
		.safeParse(input)
		.error?.issues.map((issue) => [issue.path.join("."), issue.message]) ?? [];

describe("createRecurringTransactionSchema", () => {
	it("accepts a transaction without its day, and a schedule", () => {
		expect(createRecurringTransactionSchema.parse(rent)).toEqual(rent);
		expect(
			createRecurringTransactionSchema.parse({ ...rent, mode: "automatic" })
				.mode,
		).toBe("automatic");
	});

	it("rejects a day in what it records: the schedule gives them", () => {
		expect(
			issues({
				...rent,
				transaction: { ...rent.transaction, date: "2026-12-01" },
			}),
		).toHaveLength(1);
	});

	it("rejects an interval out of bounds and an end before the start", () => {
		expect(
			issues({ ...rent, schedule: { ...rent.schedule, interval: 100 } }),
		).toEqual([["schedule.interval", "recurrence_interval_invalid"]]);
		expect(
			issues({ ...rent, schedule: { ...rent.schedule, interval: 1.5 } }),
		).toEqual([["schedule.interval", "recurrence_interval_invalid"]]);
		expect(
			issues({
				...rent,
				schedule: { ...rent.schedule, endDate: "2026-11-30" },
			}),
		).toEqual([["schedule.endDate", "recurrence_end_before_start"]]);
	});
});

describe("the recurring origin", () => {
	it("is the API's own: a client can't send it", () => {
		expect(
			createTransactionSchema.safeParse({
				...rent.transaction,
				date: "2026-12-01",
				origin: "recurring",
			}).success,
		).toBe(false);
	});
});
