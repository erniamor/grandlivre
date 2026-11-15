import type { Transaction, TransactionDraft } from "@repo/schemas";
import { json } from "@test/helpers/api";
import { WEB_ORIGIN } from "@test/helpers/auth";
import {
	addTestMember,
	createTestHousehold,
	signInUser,
	type TestUser,
} from "@test/helpers/households";
import { householdApi } from "@test/helpers/transactions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "@/app";
import { type AssistantReceipt, assistant } from "@/lib/assistant";
import { AppError } from "@/lib/errors";
import {
	RECEIPTS_PER_HOUR,
	receiptLimiter,
} from "@/routes/drafts/drafts.service";

beforeEach(() => {
	receiptLimiter.reset();
});

afterEach(() => {
	vi.restoreAllMocks();
});

/** The first bytes of a JPEG, enough for the API to take it for one. */
const JPEG = new Uint8Array([
	0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1,
]);

type ReadItem = AssistantReceipt["items"][number];

/** What the assistant read; an item says nothing of its taxes unless given. */
const reading = ({
	items = [],
	...fields
}: Partial<Omit<AssistantReceipt, "items">> & {
	items?: (Omit<ReadItem, "taxable"> & Partial<Pick<ReadItem, "taxable">>)[];
} = {}): AssistantReceipt => ({
	merchant: "Costco",
	date: "2026-11-14",
	account: null,
	note: null,
	subtotal: null,
	taxes: [],
	total: "0",
	new_tag: null,
	remark: null,
	...fields,
	items: items.map((item) => ({ taxable: null, ...item })),
});

/**
 * A household owned by Alice, with Bob; Carol is outside it. Alice holds
 * chequing; tags: Food › Groceries, Home › Household supplies, Toys.
 */
async function setUp() {
	const alice = await signInUser("alice@example.com");
	const bob = await signInUser("bob@example.com");
	const carol = await signInUser("carol@example.com");
	const household = await createTestHousehold(alice.cookie);
	await addTestMember(household.id, bob.id);
	const h = householdApi(household.id);
	const chequing = await h.account(alice, { name: "Chequing" });
	const food = await h.tag(alice, "Food");
	const groceries = await h.tag(alice, "Groceries", food.id);
	const home = await h.tag(alice, "Home");
	const supplies = await h.tag(alice, "Household supplies", home.id);
	const toys = await h.tag(alice, "Toys");

	/** Sends a photo as the browser does: a multipart form. */
	const scan = (
		user: TestUser | undefined,
		photo: Blob | string | null = new Blob([JPEG], { type: "image/jpeg" }),
		today = "2026-11-15",
	) => {
		const form = new FormData();
		if (photo !== null) {
			form.set(
				"photo",
				photo,
				...((photo instanceof Blob ? ["receipt.jpg"] : []) as []),
			);
		}
		form.set("today", today);
		return app.request(`${h.base}/transactions/draft/receipt`, {
			method: "POST",
			headers: { Origin: WEB_ORIGIN, ...(user ? { Cookie: user.cookie } : {}) },
			body: form,
		});
	};
	return { alice, bob, carol, h, chequing, groceries, supplies, toys, scan };
}

/** The assistant reads `answer`, whatever the photo; its requests are recorded. */
function assistantReads(
	answer: AssistantReceipt | ((context: string) => AssistantReceipt) | Error,
) {
	return vi
		.spyOn(assistant, "readReceipt")
		.mockImplementation(async ({ context }) => {
			if (answer instanceof Error) {
				throw answer;
			}
			return typeof answer === "function" ? answer(context) : answer;
		});
}

/** The reference the context gives a tag or an account, by its name or path. */
function referenceOf(context: string, name: string): string | null {
	const line = context
		.split("\n")
		.find(
			(each) => each.endsWith(` | ${name}`) || each.includes(` | ${name} |`),
		);
	return line?.split(" | ")[0] ?? null;
}

describe("POST /v1/households/:householdId/transactions/draft/receipt", () => {
	it("turns a receipt into a draft expense, its items grouped by tag and the taxes shared out", async () => {
		const { alice, h, groceries, supplies, toys, scan } = await setUp();
		const spy = assistantReads((context) =>
			reading({
				account: referenceOf(context, "Chequing"),
				items: [
					{
						name: "Milk 2L",
						amount: "6.49",
						tag: referenceOf(context, "Food › Groceries"),
					},
					{
						name: "Bread",
						amount: "113.51",
						tag: referenceOf(context, "Food › Groceries"),
					},
					{
						name: "Dish soap",
						amount: "45.00",
						tag: referenceOf(context, "Home › Household supplies"),
					},
					{ name: "Lego", amount: "15.00", tag: referenceOf(context, "Toys") },
				],
				subtotal: "180.00",
				taxes: [
					{ name: "TPS", amount: "9.00" },
					{ name: "TVQ", amount: "17.96" },
				],
				total: "206.96",
			}),
		);

		const response = await scan(alice);

		expect(response.status).toBe(200);
		const draft = await json<TransactionDraft>(response);
		expect(draft).toMatchObject({
			type: "expense",
			date: "2026-11-14",
			payee: "Costco",
			lines: [
				{ amount: 13_797, tagId: groceries.id, usesProposedTag: false },
				{ amount: 5174, tagId: supplies.id, usesProposedTag: false },
				{ amount: 1725, tagId: toys.id, usesProposedTag: false },
			],
			proposedTag: null,
			warnings: [],
			receipt: {
				merchant: "Costco",
				items: [
					{ name: "Milk 2L", amount: 649 },
					{ name: "Bread", amount: 11_351 },
					{ name: "Dish soap", amount: 4500 },
					{ name: "Lego", amount: 1500 },
				],
				subtotal: 18_000,
				taxes: [
					{ name: "TPS", amount: 900 },
					{ name: "TVQ", amount: 1796 },
				],
				total: 20_696,
			},
		});
		expect(draft.accountId).not.toBeNull();
		// Nothing saved
		expect((await json<{ data: unknown[] }>(await h.list(alice))).data).toEqual(
			[],
		);
		const [request] = spy.mock.calls[0] ?? [];
		expect(request?.photo.mediaType).toBe("image/jpeg");
		expect(Buffer.from(request?.photo.data ?? "", "base64")).toEqual(
			Buffer.from(JPEG),
		);
		expect(request?.today).toBe("2026-11-15");
	});

	it("puts the taxes on the items the receipt marks as taxed", async () => {
		const { alice, groceries, supplies, scan } = await setUp();
		assistantReads((context) =>
			reading({
				items: [
					{
						name: "Bread",
						amount: "15.00",
						tag: referenceOf(context, "Food › Groceries"),
						taxable: false,
					},
					{
						name: "Dish soap",
						amount: "10.00",
						tag: referenceOf(context, "Home › Household supplies"),
						taxable: true,
					},
				],
				taxes: [
					{ name: "TPS", amount: "0.50" },
					{ name: "TVQ", amount: "1.00" },
				],
				total: "26.50",
			}),
		);

		expect((await json<TransactionDraft>(await scan(alice))).lines).toEqual([
			{ amount: 1500, tagId: groceries.id, usesProposedTag: false },
			{ amount: 1150, tagId: supplies.id, usesProposedTag: false },
		]);
	});

	it("shares the taxes over every item when the receipt doesn't mark them all", async () => {
		const { alice, groceries, supplies, scan } = await setUp();
		assistantReads((context) =>
			reading({
				items: [
					{
						name: "Bread",
						amount: "15.00",
						tag: referenceOf(context, "Food › Groceries"),
						taxable: null,
					},
					{
						name: "Dish soap",
						amount: "10.00",
						tag: referenceOf(context, "Home › Household supplies"),
						taxable: true,
					},
				],
				taxes: [{ name: "TPS", amount: "1.50" }],
				total: "26.50",
			}),
		);

		expect((await json<TransactionDraft>(await scan(alice))).lines).toEqual([
			{ amount: 1590, tagId: groceries.id, usesProposedTag: false },
			{ amount: 1060, tagId: supplies.id, usesProposedTag: false },
		]);
	});

	it("lets a discount lower its tag, and keeps it in the receipt", async () => {
		const { alice, groceries, scan } = await setUp();
		assistantReads((context) =>
			reading({
				items: [
					{
						name: "Cheese",
						amount: "12.00",
						tag: referenceOf(context, "Food › Groceries"),
					},
					{
						name: "Coupon",
						amount: "-2.00",
						tag: referenceOf(context, "Food › Groceries"),
					},
				],
				total: "10.00",
			}),
		);

		const draft = await json<TransactionDraft>(await scan(alice));

		expect(draft.lines).toEqual([
			{ amount: 1000, tagId: groceries.id, usesProposedTag: false },
		]);
		expect(draft.receipt?.items).toContainEqual({
			name: "Coupon",
			amount: -200,
		});
	});

	it("follows the total when the receipt's figures don't add up, and says so", async () => {
		const { alice, scan } = await setUp();
		assistantReads(
			reading({
				items: [{ name: "Something", amount: "40.00", tag: null }],
				taxes: [{ name: "TPS", amount: "2.00" }],
				total: "50.00",
			}),
		);

		const draft = await json<TransactionDraft>(await scan(alice));

		expect(draft.lines).toEqual([
			{ amount: 5000, tagId: null, usesProposedTag: false },
		]);
		expect(draft.warnings).toEqual(["receipt_total_mismatch"]);
	});

	it("doesn't warn about a deposit left out of the subtotal, when everything adds up to the total", async () => {
		const { alice, scan } = await setUp();
		assistantReads(
			reading({
				items: [
					{ name: "Sparkling water", amount: "26.99", tag: null },
					{ name: "Bottle deposit", amount: "2.40", tag: null },
				],
				subtotal: "26.99",
				taxes: [{ name: "TPS", amount: "1.35" }],
				total: "30.74",
			}),
		);

		expect((await json<TransactionDraft>(await scan(alice))).warnings).toEqual(
			[],
		);
	});

	it("puts a receipt it couldn't detail on one uncategorized line of its total", async () => {
		const { alice, scan } = await setUp();
		assistantReads(
			reading({ total: "23.45", remark: "Les articles sont illisibles." }),
		);

		expect(await json<TransactionDraft>(await scan(alice))).toMatchObject({
			lines: [{ amount: 2345, tagId: null, usesProposedTag: false }],
			remark: "Les articles sont illisibles.",
			warnings: [],
		});
	});

	it("proposes a tag for items no tag fits, without creating it", async () => {
		const { alice, toys, scan } = await setUp();
		assistantReads((context) =>
			reading({
				items: [
					{ name: "Lottery ticket", amount: "10.00", tag: "new" },
					{ name: "Lego", amount: "15.00", tag: referenceOf(context, "Toys") },
				],
				total: "25.00",
				new_tag: {
					name_en: "Lottery",
					name_fr: "Loterie",
					name_es: "Lotería",
					parent: null,
				},
			}),
		);

		expect(await json<TransactionDraft>(await scan(alice))).toMatchObject({
			lines: [
				{ amount: 1000, tagId: null, usesProposedTag: true },
				{ amount: 1500, tagId: toys.id, usesProposedTag: false },
			],
			proposedTag: {
				names: { en: "Lottery", fr: "Loterie", es: "Lotería" },
				parentId: null,
			},
		});
	});

	it("says it couldn't read a photo that isn't a receipt", async () => {
		const { alice, scan } = await setUp();
		assistantReads(reading({ merchant: null, total: "0" }));

		const response = await scan(alice);

		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({
			error: { code: "draft_not_understood" },
		});
	});

	it("refuses a file that isn't an image, whatever its name, before asking the assistant", async () => {
		const { alice, scan } = await setUp();
		const spy = assistantReads(reading({ total: "10" }));

		const pdf = await scan(
			alice,
			new Blob(["%PDF-1.7 ..."], { type: "image/jpeg" }),
		);
		const missing = await scan(alice, null);
		const text = await scan(alice, "not a file");

		expect(pdf.status).toBe(422);
		expect(await pdf.json()).toMatchObject({
			error: {
				details: [{ field: "photo", message: "receipt_photo_invalid" }],
			},
		});
		expect(missing.status).toBe(422);
		expect(text.status).toBe(422);
		expect(spy).not.toHaveBeenCalled();
	});

	it("refuses a photo over 5 MB, and keeps the 1 MB limit everywhere else", async () => {
		const { alice, h, scan } = await setUp();
		const spy = assistantReads(reading({ total: "10" }));
		const big = new Uint8Array(5 * 1024 * 1024 + 10);
		big.set(JPEG);

		const tooBig = await scan(alice, new Blob([big], { type: "image/jpeg" }));
		const largeNote = await app.request(`${h.base}/transactions/draft`, {
			method: "POST",
			headers: {
				Origin: WEB_ORIGIN,
				Cookie: alice.cookie,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				text: "x".repeat(2 * 1024 * 1024),
				today: "2026-11-15",
			}),
		});

		expect(tooBig.status).toBe(413);
		expect(largeNote.status).toBe(413);
		expect(spy).not.toHaveBeenCalled();
	});

	it("records a reviewed draft with its receipt, kept when the transaction changes", async () => {
		const { alice, h, chequing, groceries } = await setUp();
		const receipt = {
			merchant: "IGA",
			items: [{ name: "Apples", amount: 500 }],
			subtotal: 500,
			taxes: [],
			total: 500,
		};
		const expense = {
			type: "expense",
			accountId: chequing.id,
			date: "2026-11-14",
			payee: "IGA",
			lines: [{ amount: 500, tagId: groceries.id }],
		};

		const created = await h.created(alice, {
			...expense,
			origin: "receipt",
			receipt,
		});
		const changed = await json<Transaction>(
			await h.replace(alice, created.id, { ...expense, payee: "IGA Extra" }),
		);

		expect(created).toMatchObject({ origin: "receipt", receipt });
		expect(changed).toMatchObject({
			payee: "IGA Extra",
			origin: "receipt",
			receipt,
		});
	});

	it("passes the assistant's failures on", async () => {
		const { alice, scan } = await setUp();
		assistantReads(new AppError(503, "assistant_unavailable", "Unavailable"));

		const response = await scan(alice);

		expect(response.status).toBe(503);
	});

	it(`allows ${RECEIPTS_PER_HOUR} receipts an hour per member, apart from the notes`, async () => {
		const { alice, bob, scan } = await setUp();
		assistantReads(reading({ total: "10" }));
		for (let index = 0; index < RECEIPTS_PER_HOUR; index += 1) {
			receiptLimiter.consume(alice.id);
		}

		expect((await scan(alice)).status).toBe(429);
		expect((await scan(bob)).status).toBe(200);
	});

	it("hides the household from outsiders and requires a session", async () => {
		const { carol, scan } = await setUp();
		const spy = assistantReads(reading({ total: "10" }));

		expect((await scan(carol)).status).toBe(404);
		expect((await scan(undefined)).status).toBe(401);
		expect(spy).not.toHaveBeenCalled();
	});
});
