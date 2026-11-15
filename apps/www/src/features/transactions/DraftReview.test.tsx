import type { Tag, TransactionDraft } from "@repo/schemas";
import { TooltipProvider } from "@repo/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NewTransactionPage } from "@/features/transactions/NewTransactionPage";
import {
	base,
	chequing,
	fillUp,
	food,
	gas,
	household,
	page,
	respondWith,
	savings,
	tags,
} from "@/features/transactions/transaction-test-data";
import { type ApiRequest, mockApi } from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

afterEach(() => {
	vi.restoreAllMocks();
});

const leisure: Tag = {
	id: "00000000-0000-4000-8000-000000000031",
	householdId: household.id,
	names: { en: "Leisure", fr: "Loisirs" },
	parentId: null,
	createdAt: "2026-11-14T12:00:00.000Z",
};
const lottery: Tag = {
	...leisure,
	id: "00000000-0000-4000-8000-000000000032",
	names: { en: "Lottery" },
	parentId: leisure.id,
};

const draft = (fields: Partial<TransactionDraft> = {}): TransactionDraft => ({
	type: "expense",
	date: "2026-11-14",
	accountId: savings.id,
	toAccountId: null,
	payee: "Dépanneur",
	note: null,
	lines: [{ amount: 1000, tagId: null, usesProposedTag: true }],
	proposedTag: {
		names: { en: "Lottery", fr: "Loterie", es: "Lotería" },
		parentId: leisure.id,
		similarTags: [{ tagId: food.id, reason: "contains" }],
	},
	remark: "J'ai proposé « Loisirs › Loterie ».",
	receipt: null,
	warnings: [],
	...fields,
});

/** The page on a draft kept in the cache, as the quick entry leaves it. */
function setUp(
	review: TransactionDraft,
	respond: (
		request: ApiRequest,
	) => { status: number; body?: unknown } | undefined = () => undefined,
	photo?: Blob,
) {
	const reads = respondWith();
	const requests = mockApi((request) => {
		if (request.method === "GET" && request.path === `${base}/tags`) {
			return page([...tags, leisure], { pageSize: 500 });
		}
		if (request.method === "POST" && request.path === `${base}/tags`) {
			return respond(request) ?? { status: 201, body: lottery };
		}
		if (request.method === "POST" && request.path === `${base}/transactions`) {
			return respond(request) ?? { status: 201, body: fillUp };
		}
		return reads(request);
	});
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	queryClient.setQueryData(["note-draft", "d1"], review);
	if (photo) {
		queryClient.setQueryData(["note-draft", "d1", "photo"], photo);
	}
	const onCreated = vi.fn();
	const router = createRouter({
		routeTree: createRootRoute({
			component: () => (
				<TooltipProvider>
					<Suspense fallback={<p>Loading</p>}>
						<NewTransactionPage
							household={household}
							draftId="d1"
							onCreated={onCreated}
						/>
					</Suspense>
				</TooltipProvider>
			),
		}),
		history: createMemoryHistory(),
		context: { queryClient },
	});
	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
	return {
		user: userEvent.setup(),
		onCreated,
		/** The requests that change something, without the reads. */
		writes: () => requests.filter((request) => request.method !== "GET"),
	};
}

const save = () =>
	screen.getByRole("button", { name: "Record the transaction" });
const proposal = () =>
	screen.findByRole("region", { name: "New tag proposed by the assistant" });

describe("NewTransactionPage, on a draft of the assistant", () => {
	it("fills the form with the draft, and shows the assistant's remark", async () => {
		setUp(
			draft({
				proposedTag: null,
				lines: [{ amount: 7240, tagId: gas.id, usesProposedTag: false }],
				remark: "Hier, d'après la note.",
			}),
		);

		expect(await screen.findByLabelText("Amount")).toHaveValue("72.40");
		expect(screen.getByLabelText("Tag")).toHaveValue(gas.id);
		expect(screen.getByLabelText("Account")).toHaveValue(savings.id);
		expect(screen.getByLabelText("Date")).toHaveValue("2026-11-14");
		expect(screen.getByLabelText("Paid to (optional)")).toHaveValue(
			"Dépanneur",
		);
		expect(
			screen.getByText("The assistant: Hier, d'après la note."),
		).toBeVisible();
	});

	it("records the reviewed draft as coming from a note", async () => {
		const { user, onCreated, writes } = setUp(
			draft({
				proposedTag: null,
				lines: [{ amount: 7240, tagId: gas.id, usesProposedTag: false }],
			}),
		);

		await user.click(
			await screen.findByRole("button", { name: "Record the transaction" }),
		);

		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(writes()).toEqual([
			{
				method: "POST",
				path: `${base}/transactions`,
				body: {
					type: "expense",
					accountId: savings.id,
					date: "2026-11-14",
					payee: "Dépanneur",
					note: null,
					lines: [{ amount: 7240, tagId: gas.id }],
					origin: "voice",
				},
			},
		]);
	});

	it("shows the proposed tag with the existing tags that look like it", async () => {
		setUp(draft());

		const panel = within(await proposal());

		expect(panel.getByText("Leisure › Lottery")).toBeVisible();
		expect(panel.getByText("Loterie · Lotería")).toBeVisible();
		expect(panel.getByText("Food")).toBeVisible();
		expect(panel.getByText(/close name/)).toBeVisible();
		expect(screen.getByLabelText("Tag")).toHaveValue("proposed");
		expect(
			within(screen.getByLabelText("Tag")).getByRole("option", {
				name: "New: Lottery (to create)",
			}),
		).toBeInTheDocument();
	});

	it("creates the proposed tag, then records the transaction on it", async () => {
		const { user, onCreated, writes } = setUp(draft());

		await proposal();
		await user.click(save());

		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(writes()).toEqual([
			{
				method: "POST",
				path: `${base}/tags`,
				body: {
					names: { en: "Lottery", fr: "Loterie", es: "Lotería" },
					parentId: leisure.id,
				},
			},
			{
				method: "POST",
				path: `${base}/transactions`,
				body: expect.objectContaining({
					lines: [{ amount: 1000, tagId: lottery.id }],
					origin: "voice",
				}),
			},
		]);
	});

	it("uses a similar tag instead, creating nothing", async () => {
		const { user, onCreated, writes } = setUp(draft());

		await user.click(
			within(await proposal()).getByRole("button", {
				name: "Use Food instead",
			}),
		);

		expect(
			screen.queryByRole("region", {
				name: "New tag proposed by the assistant",
			}),
		).not.toBeInTheDocument();
		expect(screen.getByLabelText("Tag")).toHaveValue(food.id);
		await user.click(save());
		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(writes().map((request) => request.path)).toEqual([
			`${base}/transactions`,
		]);
		expect(writes()[0]?.body).toMatchObject({
			lines: [{ amount: 1000, tagId: food.id }],
		});
	});

	it("leaves the line uncategorized when the proposal is turned down", async () => {
		const { user, onCreated, writes } = setUp(draft());

		await user.click(
			within(await proposal()).getByRole("button", {
				name: "Don't create it: leave uncategorized",
			}),
		);

		expect(screen.getByLabelText("Tag")).toHaveValue("");
		expect(
			within(screen.getByLabelText("Tag")).queryByRole("option", {
				name: "New: Lottery (to create)",
			}),
		).not.toBeInTheDocument();
		await user.click(save());
		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(writes()).toHaveLength(1);
		expect(writes()[0]?.body).toMatchObject({
			lines: [{ amount: 1000, tagId: null }],
		});
	});

	it("doesn't create the tag when the line is moved to another tag", async () => {
		const { user, onCreated, writes } = setUp(draft());

		await proposal();
		await user.selectOptions(screen.getByLabelText("Tag"), "Gas");
		expect(
			screen.queryByRole("region", {
				name: "New tag proposed by the assistant",
			}),
		).not.toBeInTheDocument();
		await user.click(save());

		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(writes().map((request) => request.path)).toEqual([
			`${base}/transactions`,
		]);
	});

	it("says when the tag can't be created, and doesn't create it twice on retry", async () => {
		let failures = 1;
		const { user, onCreated, writes } = setUp(draft(), (request) => {
			if (request.path === `${base}/transactions` && failures > 0) {
				failures -= 1;
				return {
					status: 500,
					body: { error: { code: "internal_error", message: "Boom" } },
				};
			}
			return undefined;
		});

		await proposal();
		await user.click(save());
		expect(await screen.findByRole("alert")).toBeVisible();
		await user.click(save());

		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(writes().map((request) => request.path)).toEqual([
			`${base}/tags`,
			`${base}/transactions`,
			`${base}/transactions`,
		]);
	});

	it("says why the proposed tag was refused", async () => {
		const { user, onCreated } = setUp(draft(), (request) =>
			request.path === `${base}/tags`
				? {
						status: 422,
						body: {
							error: {
								code: "validation_error",
								message: "Invalid request",
								details: [{ field: "names.fr", message: "tag_name_taken" }],
							},
						},
					}
				: undefined,
		);

		await proposal();
		await user.click(save());

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Another tag at the same level already has this name.",
		);
		expect(onCreated).not.toHaveBeenCalled();
	});

	it("offers the quick entry above the form, and starts blank without a draft", async () => {
		mockApi(respondWith());
		renderWithRouter(
			<NewTransactionPage household={household} onCreated={vi.fn()} />,
		);

		expect(
			await screen.findByLabelText("Describe the transaction"),
		).toBeVisible();
		expect(screen.getByLabelText("Amount")).toHaveValue("");
		expect(screen.getByLabelText("Account")).toHaveValue(chequing.id);
		expect(screen.queryByText(/^The assistant:/)).not.toBeInTheDocument();
	});

	describe("read on a receipt", () => {
		const receipt = {
			merchant: "IGA",
			items: [
				{ name: "Apples", amount: 600 },
				{ name: "Coupon", amount: -100 },
			],
			subtotal: 500,
			taxes: [
				{ name: "TPS", amount: 25 },
				{ name: "TVQ", amount: 50 },
			],
			total: 575,
		};
		const fromReceipt = (fields: Partial<TransactionDraft> = {}) =>
			draft({
				payee: "IGA",
				proposedTag: null,
				lines: [{ amount: 575, tagId: food.id, usesProposedTag: false }],
				remark: null,
				receipt,
				...fields,
			});

		it("shows the photo and what was read on it, to check the draft against", async () => {
			vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:receipt");
			vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined);
			setUp(fromReceipt(), undefined, new Blob(["photo"]));

			const details = within(
				await screen.findByRole("region", { name: "The receipt from IGA" }),
			);

			expect(
				details.getByRole("img", { name: "Photo of the receipt" }),
			).toHaveAttribute("src", "blob:receipt");
			expect(details.getByText("Items read on the receipt (2)")).toBeVisible();
			expect(details.getByText("Coupon")).toBeInTheDocument();
			expect(details.getByText("-$1.00")).toBeInTheDocument();
			expect(details.getByText("Subtotal")).toBeVisible();
			expect(details.getByText("TVQ")).toBeVisible();
			expect(details.getByText("$5.75")).toBeVisible();
		});

		it("says when the receipt's figures don't add up", async () => {
			setUp(fromReceipt({ warnings: ["receipt_total_mismatch"] }));

			expect(
				await screen.findByText(
					/^The items and taxes read on the receipt don't add up to its total/,
				),
			).toBeVisible();
		});

		it("records the expense with the receipt, as read on a receipt", async () => {
			const { user, onCreated, writes } = setUp(fromReceipt());

			await user.click(
				await screen.findByRole("button", { name: "Record the transaction" }),
			);

			await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
			expect(writes()).toEqual([
				{
					method: "POST",
					path: `${base}/transactions`,
					body: expect.objectContaining({
						payee: "IGA",
						lines: [{ amount: 575, tagId: food.id }],
						origin: "receipt",
						receipt,
					}),
				},
			]);
		});
	});
});
