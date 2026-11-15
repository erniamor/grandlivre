import type { TransactionDraft } from "@repo/schemas";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuickEntry } from "@/features/transactions/QuickEntry";
import { base, household } from "@/features/transactions/transaction-test-data";
import { localToday } from "@/features/transactions/use-local-today";
import { setTestLocale } from "@/test/locale";
import { type ApiResponse, mockApi } from "@/test/mock-api";
import { renderWithQueryClient } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

const draft: TransactionDraft = {
	type: "expense",
	date: "2026-11-14",
	accountId: null,
	toAccountId: null,
	payee: "Shell",
	note: null,
	lines: [{ amount: 7240, tagId: null, usesProposedTag: false }],
	proposedTag: null,
	remark: null,
	receipt: null,
	warnings: [],
};

function setUp(response: ApiResponse = { status: 200, body: draft }) {
	const requests = mockApi(() => response);
	const onDraft = vi.fn();
	renderWithQueryClient(
		<QuickEntry householdId={household.id} onDraft={onDraft} />,
	);
	return { user: userEvent.setup(), onDraft, requests };
}

describe("QuickEntry", () => {
	it.each([
		["en", "Describe the transaction", "Prepare"],
		["fr", "Décrivez la transaction", "Préparer"],
		["es", "Describe la transacción", "Preparar"],
	] as const)("asks for a note, in %s", (locale, label, button) => {
		setTestLocale(locale);
		setUp();

		expect(screen.getByLabelText(label)).toBeVisible();
		expect(screen.getByRole("button", { name: button })).toBeVisible();
	});

	it("sends the note with the user's day, and hands the draft on", async () => {
		const { user, onDraft, requests } = setUp();

		await user.type(
			screen.getByLabelText("Describe the transaction"),
			" essence 72,40 hier chez Shell {Enter}",
		);

		await vi.waitFor(() => expect(onDraft).toHaveBeenCalledOnce());
		expect(onDraft.mock.calls[0]?.[0]).toEqual(draft);
		expect(requests).toEqual([
			{
				method: "POST",
				path: `${base}/transactions/draft`,
				body: { text: "essence 72,40 hier chez Shell", today: localToday() },
			},
		]);
	});

	it("asks for a note before calling the assistant", async () => {
		const { user, requests } = setUp();

		await user.click(screen.getByRole("button", { name: "Prepare" }));

		expect(
			await screen.findByText("Describe the transaction, like “gas 72 $”."),
		).toBeVisible();
		expect(requests).toEqual([]);
	});

	it.each([
		[
			422,
			"draft_not_understood",
			"The assistant couldn't find a transaction in this note. Add an amount, or fill in the form below.",
		],
		[
			503,
			"assistant_unavailable",
			"The assistant is unavailable for now. Fill in the form below.",
		],
		[
			429,
			"too_many_requests",
			"Too many attempts. Wait a minute and try again.",
		],
	])("says what went wrong (%i %s)", async (status, code, message) => {
		const { user, onDraft } = setUp({
			status,
			body: { error: { code, message: code } },
		});

		await user.type(
			screen.getByLabelText("Describe the transaction"),
			"a thing{Enter}",
		);

		expect(await screen.findByRole("alert")).toHaveTextContent(message);
		expect(onDraft).not.toHaveBeenCalled();
	});

	describe("scanning a receipt", () => {
		const receiptDraft: TransactionDraft = {
			...draft,
			payee: "IGA",
			receipt: {
				merchant: "IGA",
				items: [{ name: "Apples", amount: 7240 }],
				subtotal: null,
				taxes: [],
				total: 7240,
			},
		};
		const photo = () =>
			new File([new Uint8Array([0xff, 0xd8, 0xff])], "IMG_0042.jpg", {
				type: "image/jpeg",
			});

		it.each([
			["en", "Scan a receipt"],
			["fr", "Scanner un ticket"],
			["es", "Escanear un ticket"],
		] as const)("offers to take a photo, in %s", (locale, label) => {
			setTestLocale(locale);
			setUp();

			const input = screen.getByLabelText(label);
			expect(input).toHaveAttribute("type", "file");
			expect(input).toHaveAttribute("accept", "image/*");
		});

		it("sends the photo with the user's day, and hands the draft on with the photo", async () => {
			const { user, onDraft, requests } = setUp({
				status: 200,
				body: receiptDraft,
			});

			await user.upload(screen.getByLabelText("Scan a receipt"), photo());

			await vi.waitFor(() => expect(onDraft).toHaveBeenCalledOnce());
			expect(onDraft.mock.calls[0]?.[0]).toEqual(receiptDraft);
			expect(onDraft.mock.calls[0]?.[1]).toBeInstanceOf(Blob);
			const [request] = requests;
			expect(request).toMatchObject({
				method: "POST",
				path: `${base}/transactions/draft/receipt`,
			});
			const form = request?.body as FormData;
			expect(form.get("today")).toBe(localToday());
			expect(form.get("photo")).toBeInstanceOf(Blob);
		});

		it.each([
			[
				422,
				{ code: "draft_not_understood", message: "No" },
				"The assistant couldn't read this receipt. Try a sharper photo, or fill in the form below.",
			],
			[
				422,
				{
					code: "validation_error",
					message: "Invalid",
					details: [{ field: "photo", message: "receipt_photo_invalid" }],
				},
				"This file isn't a photo the assistant can read. Choose a JPEG, PNG, WebP or GIF image.",
			],
			[
				413,
				{ code: "payload_too_large", message: "Too large" },
				"This photo is too large (5 MB at most).",
			],
		])("says what went wrong (%i)", async (status, error, message) => {
			const { user, onDraft } = setUp({ status, body: { error } });

			await user.upload(screen.getByLabelText("Scan a receipt"), photo());

			expect(await screen.findByRole("alert")).toHaveTextContent(message);
			expect(onDraft).not.toHaveBeenCalled();
		});
	});
});
