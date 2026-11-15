import type { RecurringTransaction, Transaction } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import {
	addMonths,
	emptyRecurringState,
	formFieldsOf,
	formStateOfRecurring,
	type RecurringFormState,
	recurringStateOfTransaction,
	toRecurringInput,
} from "@/features/recurring/recurring-form";

const TODAY = "2026-11-15";

function rent(fields: Partial<RecurringFormState["schedule"]> = {}) {
	const state = emptyRecurringState(TODAY);
	return {
		...state,
		transaction: {
			...state.transaction,
			accountId: "chequing",
			payee: " Landlord ",
			lines: [{ key: "a", amount: "1 500,00", tagId: "home" }],
		},
		schedule: { ...state.schedule, startDate: "2026-12-01", ...fields },
	};
}

describe("toRecurringInput", () => {
	it("sends what it records, without a day, and its schedule", () => {
		expect(toRecurringInput(rent(), "CAD", "fr", TODAY)).toEqual({
			ok: true,
			input: {
				transaction: {
					type: "expense",
					accountId: "chequing",
					note: null,
					payee: "Landlord",
					lines: [{ amount: 150_000, tagId: "home" }],
				},
				schedule: {
					unit: "month",
					interval: 1,
					startDate: "2026-12-01",
					endDate: null,
				},
				mode: "confirm",
			},
		});
	});

	it("says what can't be read, the transaction's and the schedule's", () => {
		const state = rent({ interval: "0", endDate: "2026-11-30" });
		state.transaction.lines = [{ key: "a", amount: "abc", tagId: "" }];

		expect(toRecurringInput(state, "CAD", "en", TODAY)).toEqual({
			ok: false,
			errors: {
				"lines.0.amount": "amount_invalid",
				"schedule.interval": "recurrence_interval_invalid",
				"schedule.endDate": "recurrence_end_before_start",
			},
		});
	});

	it("refuses a first day already past, unless it is the one kept from before", () => {
		const past = rent({ startDate: "2026-10-01" });
		const original = {
			unit: "month" as const,
			interval: 1,
			startDate: "2026-10-01",
			endDate: null,
		};

		expect(toRecurringInput(past, "CAD", "en", TODAY)).toMatchObject({
			errors: { "schedule.startDate": "recurrence_start_in_past" },
		});
		expect(toRecurringInput(past, "CAD", "en", TODAY, original).ok).toBe(true);
		expect(
			toRecurringInput(
				{ ...past, schedule: { ...past.schedule, interval: "2" } },
				"CAD",
				"en",
				TODAY,
				original,
			).ok,
		).toBe(false);
	});

	it("reads a whole number of weeks, months or years, up to 99", () => {
		for (const interval of ["1.5", "-1", "100", ""]) {
			expect(toRecurringInput(rent({ interval }), "CAD", "en", TODAY).ok).toBe(
				false,
			);
		}
		expect(
			toRecurringInput(rent({ interval: " 3 " }), "CAD", "en", TODAY),
		).toMatchObject({ input: { schedule: { interval: 3 } } });
	});
});

describe("formStateOfRecurring", () => {
	it("fills the form with a recurring transaction, read back the same", () => {
		const recurring: RecurringTransaction = {
			id: "r",
			householdId: "h",
			transaction: {
				type: "transfer",
				accountId: "chequing",
				toAccountId: "savings",
				amount: 20_000,
				payee: null,
				note: null,
				lines: [],
			},
			schedule: {
				unit: "week",
				interval: 2,
				startDate: "2026-11-20",
				endDate: "2027-06-30",
			},
			mode: "automatic",
			nextDate: "2026-11-20",
			createdBy: null,
			createdAt: "2026-11-15T12:00:00.000Z",
			updatedAt: "2026-11-15T12:00:00.000Z",
		};

		const state = formStateOfRecurring(recurring, "CAD", "en");

		expect(state.schedule).toEqual({
			unit: "week",
			interval: "2",
			startDate: "2026-11-20",
			endDate: "2027-06-30",
		});
		expect(
			toRecurringInput(state, "CAD", "en", TODAY, recurring.schedule),
		).toMatchObject({
			input: {
				transaction: {
					type: "transfer",
					toAccountId: "savings",
					amount: 20_000,
				},
				mode: "automatic",
			},
		});
	});
});

describe("formFieldsOf", () => {
	it("names the API's errors about what it records as the form does", () => {
		expect(
			formFieldsOf({
				"transaction.lines.0.tagId": "transaction_tag_invalid",
				"schedule.startDate": "recurrence_start_in_past",
			}),
		).toEqual({
			"lines.0.tagId": "transaction_tag_invalid",
			"schedule.startDate": "recurrence_start_in_past",
		});
	});
});

describe("addMonths", () => {
	it("keeps the day of the month, or the last of a shorter month", () => {
		expect(addMonths("2026-11-14", 1)).toBe("2026-12-14");
		expect(addMonths("2026-12-14", 1)).toBe("2027-01-14");
		expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
		expect(addMonths("2026-01-31", 3)).toBe("2026-04-30");
		expect(addMonths("2027-12-31", 2)).toBe("2028-02-29");
	});
});

describe("recurringStateOfTransaction", () => {
	const hydro: Transaction = {
		id: "t",
		householdId: "h",
		type: "expense",
		date: "2026-11-02",
		accountId: "chequing",
		toAccountId: null,
		amount: 9_000,
		payee: "Hydro",
		note: null,
		origin: "manual",
		receipt: null,
		lines: [{ id: "l", amount: 9_000, tagId: "home" }],
		createdBy: null,
		createdAt: "2026-11-02T12:00:00.000Z",
		updatedAt: "2026-11-02T12:00:00.000Z",
	};

	it("records the same, monthly, from the same day a month later", () => {
		const state = recurringStateOfTransaction(hydro, "CAD", "en", TODAY);

		expect(state.schedule).toEqual({
			unit: "month",
			interval: "1",
			startDate: "2026-12-02",
			endDate: "",
		});
		expect(state.mode).toBe("confirm");
		expect(toRecurringInput(state, "CAD", "en", TODAY)).toMatchObject({
			input: {
				transaction: {
					type: "expense",
					accountId: "chequing",
					payee: "Hydro",
					lines: [{ amount: 9_000, tagId: "home" }],
				},
			},
		});
	});

	it("starts on the first such day from today on, for an old transaction", () => {
		expect(
			recurringStateOfTransaction(
				{ ...hydro, date: "2026-01-31" },
				"CAD",
				"en",
				TODAY,
			).schedule.startDate,
		).toBe("2026-11-30");
	});
});
