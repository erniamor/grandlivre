import type { TransactionDraft } from "@repo/schemas";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuickEntry } from "@/features/transactions/QuickEntry";
import { base, household } from "@/features/transactions/transaction-test-data";
import { localToday } from "@/features/transactions/use-local-today";
import { setTestLocale } from "@/test/locale";
import { type ApiResponse, mockApi } from "@/test/mock-api";
import {
	renderWithQueryClient,
	renderWithRouter,
} from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

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

	it("keeps Prepare off until there is a note, blanks aside", async () => {
		const { user, requests } = setUp();
		const prepare = screen.getByRole("button", { name: "Prepare" });

		expect(prepare).toBeDisabled();
		await user.type(screen.getByLabelText("Describe the transaction"), "   ");
		expect(prepare).toBeDisabled();
		await user.type(
			screen.getByLabelText("Describe the transaction"),
			"gas 72",
		);
		expect(prepare).toBeEnabled();
		expect(requests).toEqual([]);
	});

	it('explains in its "?" what happens to the note, the voice and the photo', async () => {
		mockApi(() => ({ status: 200, body: draft }));
		// The "?" links to the help page: a router is needed
		renderWithRouter(
			<QuickEntry householdId={household.id} onDraft={vi.fn()} />,
		);
		const user = userEvent.setup();

		await user.click(
			await screen.findByRole("button", { name: "How does quick entry work?" }),
		);
		expect(
			await screen.findByText(
				/your voice is transcribed by Mistral, then deleted/,
			),
		).toBeVisible();
		await user.keyboard("{Escape}");
		await user.click(
			screen.getByRole("button", { name: "How does scanning a receipt work?" }),
		);
		expect(await screen.findByText(/the photo is never kept/)).toBeVisible();
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

		it("sends a photo the browser can't decode as it is, and hands the draft on with it", async () => {
			const { user, onDraft, requests } = setUp({
				status: 200,
				body: receiptDraft,
			});

			await user.upload(screen.getByLabelText("Scan a receipt"), photo());

			await vi.waitFor(() => expect(onDraft).toHaveBeenCalledOnce());
			expect(onDraft.mock.calls[0]?.[0]).toEqual(receiptDraft);
			// Without a decoder (as here), nothing to prepare: sent and kept as taken
			const photos = onDraft.mock.calls[0]?.[1];
			expect(photos?.sent).toBe(photos?.original);
			expect(photos?.original).toBeInstanceOf(Blob);
			const [request] = requests;
			expect(request).toMatchObject({
				method: "POST",
				path: `${base}/transactions/draft/receipt`,
			});
			const form = request?.body as FormData;
			expect(form.get("today")).toBe(localToday());
			expect(form.get("photo")).toBeInstanceOf(Blob);
		});

		it("opens the photo to prepare, then sends only the photo prepared, turned", async () => {
			// A browser that decodes and draws: a photo 2000 × 4000, and a canvas
			// that records its black rectangles and its turns
			const close = vi.fn();
			vi.stubGlobal(
				"createImageBitmap",
				vi.fn(async () => ({ width: 2000, height: 4000, close })),
			);
			const painted: number[][] = [];
			const rotate = vi.fn();
			vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
				drawImage: vi.fn(),
				fillRect: (...args: number[]) => painted.push(args),
				fillStyle: "",
				translate: vi.fn(),
				rotate,
				resetTransform: vi.fn(),
			} as unknown as CanvasRenderingContext2D);
			vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
				(callback) => callback(new Blob(["prepared"], { type: "image/jpeg" })),
			);
			vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:photo");
			vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined);
			const { user, onDraft, requests } = setUp({
				status: 200,
				body: receiptDraft,
			});
			const taken = photo();

			await user.upload(screen.getByLabelText("Scan a receipt"), taken);
			const dialog = within(
				await screen.findByRole("dialog", { name: "Prepare the photo" }),
			);
			expect(requests).toEqual([]);
			await user.click(dialog.getByRole("button", { name: "Turn right" }));
			await user.click(dialog.getByRole("button", { name: "Apply the frame" }));
			await user.click(dialog.getByRole("button", { name: "Add a mask" }));
			await user.click(dialog.getByRole("button", { name: "Send the photo" }));

			await vi.waitFor(() => expect(onDraft).toHaveBeenCalledOnce());
			const form = requests[0]?.body as FormData;
			expect(await (form.get("photo") as Blob).text()).toBe("prepared");
			expect(rotate).toHaveBeenCalledWith(Math.PI / 2);
			expect(painted).toHaveLength(1);
			const photos = onDraft.mock.calls[0]?.[1];
			expect(photos?.original).toBe(taken);
			expect(await photos?.sent.text()).toBe("prepared");
			expect(close).toHaveBeenCalled();
			expect(
				screen.queryByRole("dialog", { name: "Prepare the photo" }),
			).not.toBeInTheDocument();
			vi.unstubAllGlobals();
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
