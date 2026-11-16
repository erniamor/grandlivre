import type { Tag, TransactionDraft } from "@repo/schemas";
import { api, json } from "@test/helpers/api";
import {
	addTestMember,
	createTestHousehold,
	signInUser,
	type TestUser,
} from "@test/helpers/households";
import { householdApi } from "@test/helpers/transactions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AssistantDraft, assistant } from "@/lib/assistant";
import { AppError } from "@/lib/errors";
import { DRAFTS_PER_HOUR, draftLimiter } from "@/routes/drafts/drafts.service";

beforeEach(() => {
	draftLimiter.reset();
});

afterEach(() => {
	vi.restoreAllMocks();
});

const answer = (fields: Partial<AssistantDraft> = {}): AssistantDraft => ({
	type: "expense",
	date: null,
	account: null,
	to_account: null,
	payee: null,
	note: null,
	lines: [{ amount: "72.00", tag: null }],
	new_tag: null,
	remark: null,
	...fields,
});

/** The assistant answers `reply`; the requests it got are recorded. */
function assistantAnswers(reply: AssistantDraft | Error) {
	return vi
		.spyOn(assistant, "draftTransaction")
		.mockImplementation(async () => {
			if (reply instanceof Error) {
				throw reply;
			}
			return reply;
		});
}

/**
 * A household owned by Alice, with Bob; Carol is outside it. Alice holds
 * chequing (shows its details); Bob holds a card that shows only its
 * balance. Tags: Car › Gas, and Insurance at the top.
 */
async function setUp() {
	const alice = await signInUser("alice@example.com");
	const bob = await signInUser("bob@example.com");
	const carol = await signInUser("carol@example.com");
	const household = await createTestHousehold(alice.cookie);
	await addTestMember(household.id, bob.id);
	const h = householdApi(household.id);
	const chequing = await h.account(alice, { name: "Chequing" });
	const card = await h.account(bob, {
		name: "Bob's Visa",
		type: "credit_card",
		visibility: "balance",
		openingBalance: 0,
	});
	const car = await h.tag(alice, "Car");
	const gas = await h.tag(alice, "Gas", car.id);
	const insurance = await h.tag(alice, "Insurance");
	const draft = (
		user: TestUser,
		text = "gas 72",
		headers?: Record<string, string>,
	) =>
		api(`${h.base}/transactions/draft`, {
			method: "POST",
			cookie: user.cookie,
			body: { text, today: "2026-11-15" },
			headers,
		});
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
		insurance,
		draft,
	};
}

/** The references the assistant got: "a1" → the account's name, "t2" → the tag's path. */
function referencesIn(context: string) {
	return Object.fromEntries(
		context
			.split("\n")
			.filter((line) => /^[at]\d+ \| /.test(line))
			.map((line) => {
				const [reference = "", name = ""] = line.split(" | ");
				return [name, reference];
			}),
	);
}

describe("POST /v1/households/:householdId/transactions/draft", () => {
	it("turns a note into a draft, without saving anything", async () => {
		const { alice, h, chequing, gas, draft } = await setUp();
		const spy = assistantAnswers(answer());
		const refs = () => referencesIn(spy.mock.calls[0]?.[0].context ?? "");
		spy.mockImplementation(async () =>
			answer({
				date: "2026-11-14",
				account: refs().Chequing ?? null,
				payee: " Shell ",
				lines: [{ amount: "72.40", tag: refs()["Car › Gas"] ?? null }],
				remark: "Hier, d'après la note.",
			}),
		);

		const response = await draft(alice, "essence 72,40 hier chez Shell");

		expect(response.status).toBe(200);
		expect(await json<TransactionDraft>(response)).toEqual({
			type: "expense",
			date: "2026-11-14",
			accountId: chequing.id,
			toAccountId: null,
			payee: "Shell",
			note: null,
			lines: [{ amount: 7240, tagId: gas.id, usesProposedTag: false }],
			proposedTag: null,
			remark: "Hier, d'après la note.",
			receipt: null,
			warnings: [],
		});
		const transactions = await json<{ data: unknown[] }>(await h.list(alice));
		expect(transactions.data).toEqual([]);
	});

	it("gives the assistant the note, the member's day, the accounts, the tags and the habits", async () => {
		const { alice, h, chequing, gas, draft } = await setUp();
		await h.create(alice, {
			type: "expense",
			accountId: chequing.id,
			date: "2026-11-01",
			payee: "Shell",
			lines: [{ amount: 100, tagId: gas.id }],
		});
		const spy = assistantAnswers(answer());

		await draft(alice, "essence 72", { "Accept-Language": "fr-CA,fr;q=0.9" });

		const [request] = spy.mock.calls[0] ?? [];
		expect(request?.entry).toBe("Today: 2026-11-15\n<entry>essence 72</entry>");
		expect(request?.context).toContain("Household currency: CAD");
		expect(request?.context).toContain("Member's language: fr");
		expect(request?.context).toMatch(/a\d \| Chequing \| checking \| yours/);
		expect(request?.context).toMatch(/a\d \| Bob's Visa \| credit_card\n/);
		expect(request?.context).toMatch(/t\d \| Car › Gas/);
		expect(request?.context).toMatch(/Shell → t\d/);
	});

	it("keeps the habits of an account that hides its transactions from the member", async () => {
		const { alice, bob, h, card, gas, draft } = await setUp();
		await h.create(bob, {
			type: "expense",
			accountId: card.id,
			date: "2026-11-01",
			payee: "Secret shop",
			lines: [{ amount: 100, tagId: gas.id }],
		});
		const spy = assistantAnswers(answer());

		await draft(alice);
		await draft(bob);

		expect(spy.mock.calls[0]?.[0].context).not.toContain("Secret shop");
		expect(spy.mock.calls[1]?.[0].context).toContain("Secret shop");
	});

	it("drops what doesn't belong to the household, or to the member", async () => {
		const { alice, draft } = await setUp();
		const spy = assistantAnswers(answer());
		spy.mockImplementation(async (request) => {
			const refs = referencesIn(request.context);
			return answer({
				// Bob's card: Alice doesn't hold it
				account: refs["Bob's Visa"] ?? null,
				date: "2026-02-30",
				lines: [
					{ amount: "10", tag: "t99" },
					{ amount: "not an amount", tag: null },
					{ amount: "5.5", tag: null },
				],
			});
		});

		const result = await json<TransactionDraft>(await draft(alice));

		expect(result).toMatchObject({
			accountId: null,
			date: "2026-11-15",
			lines: [
				{ amount: 1000, tagId: null, usesProposedTag: false },
				{ amount: 550, tagId: null, usesProposedTag: false },
			],
		});
	});

	it("drafts a transfer: one amount, no tag, to another account of the household", async () => {
		const { alice, chequing, card, draft } = await setUp();
		assistantAnswers(answer()).mockImplementation(async (request) => {
			const refs = referencesIn(request.context);
			return answer({
				type: "transfer",
				account: refs.Chequing ?? null,
				to_account: refs["Bob's Visa"] ?? null,
				payee: "ignored",
				lines: [
					{ amount: "300", tag: refs.Insurance ?? null },
					{ amount: "5", tag: null },
				],
			});
		});

		expect(
			await json<TransactionDraft>(
				await draft(alice, "virement 300 vers la visa"),
			),
		).toMatchObject({
			type: "transfer",
			accountId: chequing.id,
			toAccountId: card.id,
			payee: null,
			lines: [{ amount: 30_000, tagId: null, usesProposedTag: false }],
		});
	});

	describe("a proposed tag", () => {
		const proposing = (newTag: AssistantDraft["new_tag"]) =>
			assistantAnswers(answer()).mockImplementation(async (request) => {
				const refs = referencesIn(request.context);
				return answer({
					lines: [{ amount: "12", tag: "new" }],
					new_tag: newTag && {
						...newTag,
						parent: newTag.parent && (refs[newTag.parent] ?? null),
					},
				});
			});

		it("comes named in every language, under its parent, with the tags that look like it, and isn't created", async () => {
			const { alice, car, insurance, h, draft } = await setUp();
			proposing({
				name_en: "Car insurance",
				name_fr: "Assurance auto",
				name_es: "Seguro de coche",
				parent: "Car",
			});

			const result = await json<TransactionDraft>(await draft(alice));

			expect(result.lines).toEqual([
				{ amount: 1200, tagId: null, usesProposedTag: true },
			]);
			expect(result.proposedTag).toEqual({
				names: {
					en: "Car insurance",
					fr: "Assurance auto",
					es: "Seguro de coche",
				},
				parentId: car.id,
				similarTags: [{ tagId: insurance.id, reason: "contains" }],
			});
			const tags = await json<{ data: Tag[] }>(
				await api(`${h.base}/tags`, { cookie: alice.cookie }),
			);
			expect(tags.data).toHaveLength(3);
		});

		it("becomes the existing tag when one of the same name has the same parent", async () => {
			const { alice, gas, draft } = await setUp();
			proposing({
				name_en: "GAS",
				name_fr: "Essence",
				name_es: "Gasolina",
				parent: "Car",
			});

			expect(await json<TransactionDraft>(await draft(alice))).toMatchObject({
				lines: [{ amount: 1200, tagId: gas.id, usesProposedTag: false }],
				proposedTag: null,
			});
		});

		it("stays a proposal when the same name is under another parent, showing that tag", async () => {
			const { alice, gas, draft } = await setUp();
			proposing({
				name_en: "Gas",
				name_fr: "Essence",
				name_es: "Gasolina",
				parent: null,
			});

			const result = await json<TransactionDraft>(await draft(alice));

			expect(result.proposedTag).toMatchObject({
				parentId: null,
				similarTags: [{ tagId: gas.id, reason: "same_name" }],
			});
		});

		it("is dropped when its names aren't valid, the line left uncategorized", async () => {
			const { alice, draft } = await setUp();
			proposing({
				name_en: " ",
				name_fr: "x".repeat(41),
				name_es: "Nada",
				parent: null,
			});

			expect(await json<TransactionDraft>(await draft(alice))).toMatchObject({
				lines: [{ amount: 1200, tagId: null, usesProposedTag: false }],
				proposedTag: null,
			});
		});
	});

	it("says the note wasn't understood when no amount could be read", async () => {
		const { alice, draft } = await setUp();
		assistantAnswers(answer({ lines: [{ amount: "a lot", tag: null }] }));

		const response = await draft(alice, "beaucoup");

		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({
			error: { code: "draft_not_understood" },
		});
	});

	it("passes the assistant's failures on", async () => {
		const { alice, draft } = await setUp();
		assistantAnswers(new AppError(503, "assistant_unavailable", "Unavailable"));

		const response = await draft(alice);

		expect(response.status).toBe(503);
		expect(await response.json()).toMatchObject({
			error: { code: "assistant_unavailable" },
		});
	});

	it("refuses an empty note before asking the assistant", async () => {
		const { alice, h } = await setUp();
		const spy = assistantAnswers(answer());

		const response = await api(`${h.base}/transactions/draft`, {
			method: "POST",
			cookie: alice.cookie,
			body: { text: " ", today: "2026-11-15" },
		});

		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({
			error: { details: [{ field: "text", message: "draft_text_required" }] },
		});
		expect(spy).not.toHaveBeenCalled();
	});

	it(`allows ${DRAFTS_PER_HOUR} notes an hour per member, then refuses`, async () => {
		const { alice, bob, draft } = await setUp();
		const spy = assistantAnswers(answer());
		for (let index = 0; index < DRAFTS_PER_HOUR; index += 1) {
			draftLimiter.consume(alice.id);
		}

		const refused = await draft(alice);
		const other = await draft(bob);

		expect(refused.status).toBe(429);
		expect(await refused.json()).toMatchObject({
			error: { code: "too_many_requests" },
		});
		expect(other.status).toBe(200);
		expect(spy).toHaveBeenCalledOnce();
	});

	it("hides the household from outsiders and requires a session", async () => {
		const { carol, h, draft } = await setUp();
		const spy = assistantAnswers(answer());

		expect((await draft(carol)).status).toBe(404);
		expect(
			(
				await api(`${h.base}/transactions/draft`, {
					method: "POST",
					body: { text: "gas 72", today: "2026-11-15" },
				})
			).status,
		).toBe(401);
		expect(spy).not.toHaveBeenCalled();
	});
});
