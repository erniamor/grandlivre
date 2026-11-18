import type { PayeeTagSuggestions } from "@repo/schemas";
import { api, json } from "@test/helpers/api";
import {
	addTestMember,
	createTestHousehold,
	signInUser,
	type TestUser,
} from "@test/helpers/households";
import { householdApi } from "@test/helpers/transactions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AssistantTagSuggestions, assistant } from "@/lib/assistant";
import { AppError } from "@/lib/errors";
import { tagSuggestionLimiter } from "@/routes/transactions/categorize.service";

beforeEach(() => {
	tagSuggestionLimiter.reset();
});

afterEach(() => {
	vi.restoreAllMocks();
});

/** The assistant answers what `reply` makes of the request; the requests are recorded. */
function assistantAnswers(
	reply: (context: string) => AssistantTagSuggestions | Error,
) {
	return vi
		.spyOn(assistant, "suggestTags")
		.mockImplementation(async ({ context }) => {
			const answer = reply(context);
			if (answer instanceof Error) {
				throw answer;
			}
			return answer;
		});
}

/** The reference the context gives a tag's path: "t3" for "Fuel". */
function referenceOf(context: string, path: string): string {
	const line = context.split("\n").find((text) => text.endsWith(` | ${path}`));
	return line?.split(" | ")[0] ?? "";
}

/**
 * Alice's account: two Costco fuel expenses without a tag (two spellings)
 * and one tagged Fuel, a SAAQ expense, a refund from Costco. Bob's account:
 * a Costco expense of his own. Tags: Car › Registration, and Fuel.
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
	const car = await h.tag(alice, "Car");
	await h.tag(alice, "Registration", car.id);
	const fuel = await h.tag(alice, "Fuel");
	const expense = (
		user: TestUser,
		accountId: string,
		payee: string,
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
	await expense(alice, chequing.id, "COSTCO ESSENCE W100", 60_00, "2026-10-01");
	await expense(
		alice,
		chequing.id,
		"COSTCO ESSENCE W1234",
		40_00,
		"2026-10-20",
	);
	await expense(
		alice,
		chequing.id,
		"COSTCO ESSENCE W100",
		50_00,
		"2026-10-10",
		fuel.id,
	);
	await expense(alice, chequing.id, "SAAQ", 350_86, "2026-10-05");
	await h.created(alice, {
		type: "income",
		accountId: chequing.id,
		date: "2026-10-25",
		payee: "Costco essence W100",
		lines: [{ amount: 5_00 }],
	});
	await expense(bob, bobs.id, "COSTCO ESSENCE W100", 70_00, "2026-10-12");
	const suggest = (user: TestUser | undefined, body: unknown) =>
		api(`${h.base}/transactions/uncategorized/suggest`, {
			method: "POST",
			cookie: user?.cookie,
			body,
		});
	return { alice, bob, carol, h, fuel, suggest };
}

const costco = { key: "costcoessencew", type: "expense" };
const saaq = { key: "saaq", type: "expense" };

describe("POST /v1/households/:householdId/transactions/uncategorized/suggest", () => {
	it("gives the assistant the member's payees, the tags and the habits, and checks its answer", async () => {
		const { alice, fuel, suggest } = await setUp();
		const spy = assistantAnswers((context) => ({
			suggestions: [
				{ payee: "p1", tag: referenceOf(context, "Fuel") },
				// A tag that doesn't exist: no suggestion
				{ payee: "p2", tag: "t99" },
			],
		}));

		const response = await suggest(alice, { payees: [saaq, costco] });

		expect(response.status).toBe(200);
		expect(await json<PayeeTagSuggestions>(response)).toEqual({
			suggestions: [
				{ ...costco, tagId: fuel.id },
				{ ...saaq, tagId: null },
			],
		});
		const request = spy.mock.calls[0]?.[0];
		// Alice's own, the most transactions first, as most of them write it
		expect(request?.payees).toBe(
			[
				"p1 | expense | COSTCO ESSENCE W100 | 2 times | usually 60.00",
				"p2 | expense | SAAQ | 1 time | usually 350.86",
			].join("\n"),
		);
		expect(request?.context).toContain("Car › Registration");
		expect(referenceOf(request?.context ?? "", "Car › Registration")).toMatch(
			/^t\d+$/,
		);
		expect(request?.context).toContain(
			`COSTCO ESSENCE W100 → ${referenceOf(request?.context ?? "", "Fuel")}`,
		);
	});

	it("leaves out a payee with nothing left without a tag, without asking", async () => {
		const { alice, suggest } = await setUp();
		const spy = assistantAnswers(() => ({ suggestions: [] }));

		const response = await suggest(alice, {
			payees: [{ key: "netflix", type: "expense" }],
		});

		expect(await json<PayeeTagSuggestions>(response)).toEqual({
			suggestions: [],
		});
		expect(spy).not.toHaveBeenCalled();
	});

	it("says when the assistant is unavailable", async () => {
		const { alice, suggest } = await setUp();
		assistantAnswers(
			() => new AppError(503, "assistant_unavailable", "Unavailable"),
		);

		const response = await suggest(alice, { payees: [costco] });

		expect(response.status).toBe(503);
	});

	it("limits how often a member asks", async () => {
		const { alice, bob, suggest } = await setUp();
		assistantAnswers(() => ({ suggestions: [] }));
		for (let count = 0; count < 30; count++) {
			tagSuggestionLimiter.consume(alice.id);
		}

		expect((await suggest(alice, { payees: [costco] })).status).toBe(429);
		expect((await suggest(bob, { payees: [costco] })).status).toBe(200);
	});

	it("refuses an empty request, hides the household from outsiders and requires a session", async () => {
		const { alice, carol, suggest } = await setUp();
		assistantAnswers(() => ({ suggestions: [] }));

		expect((await suggest(alice, { payees: [] })).status).toBe(422);
		expect((await suggest(carol, { payees: [costco] })).status).toBe(404);
		expect((await suggest(undefined, { payees: [costco] })).status).toBe(401);
	});
});
