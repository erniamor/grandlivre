import type {
	Household,
	Settlement,
	SharedExpense,
	SharingOverview,
	Transaction,
} from "@repo/schemas";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Header } from "@/components/Header";
import { SettlePage } from "@/features/sharing/SettlePage";
import { SharingPage } from "@/features/sharing/SharingPage";
import { EditTransactionPage } from "@/features/transactions/EditTransactionPage";
import { NewTransactionPage } from "@/features/transactions/NewTransactionPage";
import {
	accounts,
	base,
	bobsCard,
	chequing,
	fillUp,
	gas,
	household,
	page,
	respondWith,
} from "@/features/transactions/transaction-test-data";
import {
	type ApiRequest,
	type ApiResponse,
	aliceProfile,
	mockApi,
} from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

const ALICE = aliceProfile.id;
const BOB = bobsCard.holders[0]?.userId ?? "";
const NOW = "2026-11-15T12:00:00.000Z";

const sharing: Household = { ...household, expenseSharing: true };

const overview: SharingOverview = {
	weights: [
		{ userId: ALICE, weight: 1 },
		{ userId: BOB, weight: 1 },
	],
	balances: [
		{ userId: ALICE, name: "Alice", isMember: true, balance: 6_000 },
		{ userId: BOB, name: "Bob", isMember: true, balance: -6_000 },
	],
	suggestions: [{ fromUserId: BOB, toUserId: ALICE, amount: 6_000 }],
};

/** A joint account of Alice and Bob: already common money. */
const joint = {
	...chequing,
	id: "00000000-0000-4000-8000-000000000009",
	name: "Joint",
	holders: [
		{ userId: ALICE, name: "Alice" },
		{ userId: BOB, name: "Bob" },
	],
};

const reads = respondWith();

function api(
	respond: (request: ApiRequest) => ApiResponse | undefined = () => undefined,
) {
	const requests = mockApi((request) => {
		const answer = respond(request);
		if (answer) {
			return answer;
		}
		if (request.method === "GET" && request.path === `${base}/sharing`) {
			return { status: 200, body: overview };
		}
		if (request.method === "GET" && request.path === `${base}/accounts`) {
			return page([...accounts, joint], { pageSize: 100 });
		}
		return reads(request);
	});
	return () => requests.filter((request) => request.method !== "GET");
}

describe("the transaction form, in a household that shares expenses", () => {
	it("shares an expense paid from one's own account, in equal parts by default", async () => {
		const writes = api((request) =>
			request.method === "POST" ? { status: 201, body: fillUp } : undefined,
		);
		const onCreated = vi.fn();
		const user = userEvent.setup();
		renderWithRouter(
			<NewTransactionPage household={sharing} onCreated={onCreated} />,
		);

		await user.type(await screen.findByLabelText("Amount"), "120");
		await user.click(
			await screen.findByRole("checkbox", { name: "Share between members" }),
		);
		expect(screen.getByRole("checkbox", { name: "Alice" })).toBeChecked();
		expect(screen.getByRole("checkbox", { name: "Bob" })).toBeChecked();
		await user.click(
			screen.getByRole("button", { name: "Record the transaction" }),
		);

		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(writes()[0]?.body).toMatchObject({
			accountId: chequing.id,
			lines: [{ amount: 12_000 }],
			shares: { mode: "equal", userIds: [ALICE, BOB] },
		});
	});

	it("shares by amounts, checked before sending", async () => {
		const writes = api(() => undefined);
		const user = userEvent.setup();
		renderWithRouter(
			<NewTransactionPage household={sharing} onCreated={vi.fn()} />,
		);

		await user.type(await screen.findByLabelText("Amount"), "100");
		await user.click(
			await screen.findByRole("checkbox", { name: "Share between members" }),
		);
		await user.click(screen.getByRole("radio", { name: "Amounts" }));
		await user.type(screen.getByLabelText("Amount of Bob"), "abc");
		await user.click(
			screen.getByRole("button", { name: "Record the transaction" }),
		);

		expect(await screen.findByText(/^Enter an amount/)).toBeVisible();
		expect(writes()).toEqual([]);
	});

	it("doesn't offer to share on a joint account, nor in a household that doesn't share", async () => {
		api();
		const user = userEvent.setup();
		const { unmount } = renderWithRouter(
			<NewTransactionPage
				household={sharing}
				accountId={joint.id}
				onCreated={vi.fn()}
			/>,
		);

		await screen.findByLabelText("Amount");
		expect(screen.getByLabelText("Account")).toHaveValue(joint.id);
		expect(
			screen.queryByRole("checkbox", { name: "Share between members" }),
		).not.toBeInTheDocument();
		await user.selectOptions(screen.getByLabelText("Account"), chequing.id);
		expect(
			await screen.findByRole("checkbox", { name: "Share between members" }),
		).toBeVisible();
		unmount();

		renderWithRouter(
			<NewTransactionPage household={household} onCreated={vi.fn()} />,
		);
		await screen.findByLabelText("Amount");
		expect(
			screen.queryByRole("checkbox", { name: "Share between members" }),
		).not.toBeInTheDocument();
	});

	it("stops sharing a transaction when unchecked", async () => {
		const shared: Transaction = {
			...fillUp,
			sharing: {
				paidBy: ALICE,
				split: { mode: "equal", userIds: [ALICE, BOB] },
				parts: [
					{ userId: ALICE, amount: 3_600 },
					{ userId: BOB, amount: 3_600 },
				],
			},
		};
		const writes = api((request) => {
			if (
				request.method === "GET" &&
				request.path === `${base}/transactions/${shared.id}`
			) {
				return { status: 200, body: shared };
			}
			return request.method === "PUT"
				? { status: 200, body: fillUp }
				: undefined;
		});
		const onDone = vi.fn();
		const user = userEvent.setup();
		renderWithRouter(
			<EditTransactionPage
				household={sharing}
				transactionId={shared.id}
				onDone={onDone}
			/>,
		);

		const toggle = await screen.findByRole("checkbox", {
			name: "Share between members",
		});
		expect(toggle).toBeChecked();
		await user.click(toggle);
		await user.click(screen.getByRole("button", { name: "Save" }));

		await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
		expect(writes()[0]?.body).toMatchObject({
			shares: null,
			lines: [{ tagId: gas.id }],
		});
	});
});

describe("SharingPage", () => {
	const expense: SharedExpense = {
		transactionId: fillUp.id,
		type: "expense",
		date: "2026-11-14",
		payee: "IGA",
		amount: 12_000,
		paidBy: ALICE,
		parts: [
			{ userId: ALICE, amount: 6_000 },
			{ userId: BOB, amount: 6_000 },
		],
	};
	const settlement: Settlement = {
		id: "00000000-0000-4000-8000-000000000081",
		fromUserId: BOB,
		toUserId: ALICE,
		amount: 2_000,
		date: "2026-11-10",
		note: "Interac",
		transactionId: null,
		createdAt: NOW,
	};

	function setUp(
		respond: (request: ApiRequest) => ApiResponse | undefined = () => undefined,
	) {
		const writes = api((request) => {
			if (request.path === `${base}/sharing/expenses`) {
				return page([expense]);
			}
			if (
				request.method === "GET" &&
				request.path === `${base}/sharing/settlements`
			) {
				return page([settlement]);
			}
			return respond(request);
		});
		renderWithRouter(<SharingPage household={sharing} meId={ALICE} />);
		return { writes, user: userEvent.setup() };
	}

	it("shows who owes whom, and offers to settle", async () => {
		setUp();

		const balances = within(
			await screen.findByRole("region", { name: "Balances" }),
		);
		expect(balances.getByText("Alice (you)")).toBeVisible();
		expect(balances.getByText("Is owed $60.00")).toBeVisible();
		expect(balances.getByText("Owes $60.00")).toBeVisible();
		const settle = within(screen.getByRole("region", { name: "To settle" }));
		expect(settle.getByText("Bob pays Alice $60.00")).toBeVisible();
		expect(
			settle.getByRole("link", { name: "Settle: Bob pays Alice $60.00" }),
		).toHaveAttribute(
			"href",
			`/shared/settle?from=${BOB}&to=${ALICE}&amount=6000`,
		);
	});

	it("lists the shared expenses with each part, and the settlements", async () => {
		setUp();

		const expenses = within(
			await screen.findByRole("region", { name: "Shared expenses" }),
		);
		expect(
			expenses.getByText(
				"Saturday, November 14, 2026 · Paid by Alice · Your part: $60.00",
			),
		).toBeVisible();
		expect(expenses.getByText("Alice $60.00 · Bob $60.00")).toBeVisible();
		const settlements = within(
			screen.getByRole("region", { name: "Settlements" }),
		);
		expect(settlements.getByText("Bob paid Alice $20.00")).toBeVisible();
		expect(
			settlements.getByText(
				"Tuesday, November 10, 2026 · Outside the accounts · Interac",
			),
		).toBeVisible();
	});

	it("lets an owner change the default split", async () => {
		const { writes, user } = setUp((request) =>
			request.method === "PUT" ? { status: 200, body: overview } : undefined,
		);

		const bob = await screen.findByLabelText("Proportion of Bob");
		await user.clear(screen.getByLabelText("Proportion of Alice"));
		await user.type(screen.getByLabelText("Proportion of Alice"), "60");
		await user.clear(bob);
		await user.type(bob, "40");
		await user.click(screen.getByRole("button", { name: "Save the split" }));

		await vi.waitFor(() =>
			expect(writes()).toEqual([
				{
					method: "PUT",
					path: `${base}/sharing/weights`,
					body: {
						weights: [
							{ userId: ALICE, weight: 60 },
							{ userId: BOB, weight: 40 },
						],
					},
				},
			]),
		);
	});

	it("deletes a settlement after a confirmation", async () => {
		const { writes, user } = setUp((request) =>
			request.method === "DELETE" ? { status: 204 } : undefined,
		);

		await user.click(
			await screen.findByRole("button", {
				name: "Delete the settlement: Bob paid Alice $20.00",
			}),
		);
		await user.click(screen.getByRole("button", { name: "Delete" }));

		await vi.waitFor(() =>
			expect(writes()).toEqual([
				{
					method: "DELETE",
					path: `${base}/sharing/settlements/${settlement.id}`,
					body: undefined,
				},
			]),
		);
	});
});

describe("SettlePage", () => {
	it("records the payment proposed, with the transfer between the accounts", async () => {
		const writes = api((request) =>
			request.method === "POST"
				? {
						status: 201,
						body: {
							id: "00000000-0000-4000-8000-000000000082",
							fromUserId: ALICE,
							toUserId: BOB,
							amount: 6_000,
							date: "2026-11-15",
							note: null,
							transactionId: null,
							createdAt: NOW,
						},
					}
				: undefined,
		);
		const onSettled = vi.fn();
		const user = userEvent.setup();
		renderWithRouter(
			<SettlePage
				household={sharing}
				meId={ALICE}
				proposed={{ from: ALICE, to: BOB, amount: 6_000 }}
				onSettled={onSettled}
			/>,
		);

		expect(await screen.findByLabelText("Who pays")).toHaveValue(ALICE);
		expect(screen.getByLabelText("Who is paid")).toHaveValue(BOB);
		expect(screen.getByLabelText("Amount")).toHaveValue("60.00");
		await user.click(
			screen.getByRole("checkbox", {
				name: "Also record the transfer between our accounts",
			}),
		);
		await user.selectOptions(
			screen.getByLabelText("From the account"),
			chequing.id,
		);
		await user.selectOptions(
			screen.getByLabelText("To the account"),
			bobsCard.id,
		);
		await user.click(
			screen.getByRole("button", { name: "Record the settlement" }),
		);

		await vi.waitFor(() => expect(onSettled).toHaveBeenCalledOnce());
		expect(writes()).toMatchObject([
			{
				method: "POST",
				path: `${base}/sharing/settlements`,
				body: {
					fromUserId: ALICE,
					toUserId: BOB,
					amount: 6_000,
					transfer: { fromAccountId: chequing.id, toAccountId: bobsCard.id },
				},
			},
		]);
	});

	it("only offers the transfer to the one who pays", async () => {
		api();
		renderWithRouter(
			<SettlePage
				household={sharing}
				meId={ALICE}
				proposed={{ from: BOB, to: ALICE, amount: 6_000 }}
				onSettled={vi.fn()}
			/>,
		);

		expect(await screen.findByLabelText("Who pays")).toHaveValue(BOB);
		expect(
			screen.queryByRole("checkbox", {
				name: "Also record the transfer between our accounts",
			}),
		).not.toBeInTheDocument();
	});
});

describe("the navigation", () => {
	it("shows Sharing only to a household that shares expenses", async () => {
		const { router } = renderWithRouter(
			<Header appearance="system" theme="stationery" me={aliceProfile} />,
		);
		const nav = await screen.findByRole("navigation", { name: "Main" });
		expect(
			within(nav).queryByRole("link", { name: "Sharing" }),
		).not.toBeInTheDocument();

		const { queryClient } = router.options.context as {
			queryClient: import("@tanstack/react-query").QueryClient;
		};
		act(() => {
			queryClient.setQueryData(["households"], {
				items: [sharing],
				page: 1,
				pageSize: 20,
				total: 1,
			});
		});

		expect(
			await within(nav).findByRole("link", { name: "Sharing" }),
		).toHaveAttribute("href", "/shared");
	});
});
