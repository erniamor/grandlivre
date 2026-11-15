import { describe, expect, it } from "vitest";
import {
	createHouseholdSchema,
	HOUSEHOLD_NAME_MAX_LENGTH,
	inviteHouseholdMemberSchema,
	updateHouseholdSchema,
} from "./household.schema";

function messages(result: { error?: { issues: { message: string }[] } }) {
	return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe("createHouseholdSchema", () => {
	it("accepts a name, trimmed, and a supported currency", () => {
		expect(
			createHouseholdSchema.parse({
				name: "  The Tremblays ",
				currency: "CAD",
			}),
		).toEqual({ name: "The Tremblays", currency: "CAD" });
	});

	it("rejects a blank or too long name", () => {
		expect(
			messages(
				createHouseholdSchema.safeParse({ name: "  ", currency: "CAD" }),
			),
		).toEqual(["household_name_required"]);
		expect(
			messages(
				createHouseholdSchema.safeParse({
					name: "a".repeat(HOUSEHOLD_NAME_MAX_LENGTH + 1),
					currency: "CAD",
				}),
			),
		).toEqual(["household_name_too_long"]);
	});

	it("rejects an unsupported currency", () => {
		for (const currency of ["cad", "XXX", "", "DOLLAR"]) {
			expect(
				messages(createHouseholdSchema.safeParse({ name: "Home", currency })),
			).toEqual(["household_currency_invalid"]);
		}
	});

	it("accepts a time zone the runtime knows, and only that", () => {
		const household = { name: "Home", currency: "CAD" };

		expect(
			createHouseholdSchema.parse({ ...household, timeZone: "America/Toronto" })
				.timeZone,
		).toBe("America/Toronto");
		expect(
			messages(
				createHouseholdSchema.safeParse({
					...household,
					timeZone: "Mars/Olympus_Mons",
				}),
			),
		).toEqual(["household_time_zone_invalid"]);
	});

	it("rejects an unknown field", () => {
		expect(
			createHouseholdSchema.safeParse({
				name: "Home",
				currency: "CAD",
				role: "owner",
			}).success,
		).toBe(false);
	});
});

describe("updateHouseholdSchema", () => {
	it("accepts any subset of the fields", () => {
		expect(updateHouseholdSchema.parse({ currency: "EUR" })).toEqual({
			currency: "EUR",
		});
		expect(updateHouseholdSchema.parse({})).toEqual({});
	});

	it("still validates the fields it receives", () => {
		expect(messages(updateHouseholdSchema.safeParse({ name: " " }))).toEqual([
			"household_name_required",
		]);
	});
});

describe("inviteHouseholdMemberSchema", () => {
	it("normalizes the email", () => {
		expect(
			inviteHouseholdMemberSchema.parse({ email: " Alice@Example.com " }),
		).toEqual({ email: "alice@example.com" });
	});

	it("rejects an invalid email", () => {
		expect(
			messages(inviteHouseholdMemberSchema.safeParse({ email: "alice" })),
		).toEqual(["email_invalid"]);
	});
});
