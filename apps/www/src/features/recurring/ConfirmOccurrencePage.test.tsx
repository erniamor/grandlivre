import type { RecurringTransaction } from "@repo/schemas";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmOccurrencePage } from "@/features/recurring/ConfirmOccurrencePage";
import {
	base,
	chequing,
	fillUp,
	gas,
	household,
	page,
	respondWith,
	savings,
} from "@/features/transactions/transaction-test-data";
import { type ApiRequest, mockApi } from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

const NOW = "2026-11-15T12:00:00.000Z";
const OCCURRENCE = "00000000-0000-4000-8000-000000000071";

const hydro: RecurringTransaction = {
	id: "00000000-0000-4000-8000-000000000061",
	householdId: household.id,
	transaction: {
		type: "expense",
		accountId: chequing.id,
		toAccountId: null,
		amount: 9_000,
		payee: "Hydro",
		note: null,
		lines: [{ amount: 9_000, tagId: gas.id }],
	},
	schedule: {
		unit: "month",
		interval: 2,
		startDate: "2026-11-10",
		endDate: null,
	},
	mode: "confirm",
	nextDate: "2027-01-10",
	createdBy: null,
	createdAt: NOW,
	updatedAt: NOW,
};

function setUp(recurring: RecurringTransaction = hydro) {
	const reads = respondWith();
	const requests = mockApi((request) => {
		if (request.path === `${base}/recurring-transactions/pending`) {
			return page([{ id: OCCURRENCE, date: "2026-11-10", recurring }]);
		}
		if (request.path.endsWith("/confirm")) {
			return { status: 201, body: fillUp };
		}
		if (request.path.endsWith("/skip")) {
			return { status: 204 };
		}
		return reads(request);
	});
	const onDone = vi.fn();
	renderWithRouter(
		<ConfirmOccurrencePage
			household={household}
			occurrenceId={OCCURRENCE}
			onDone={onDone}
		/>,
	);
	return {
		user: userEvent.setup(),
		onDone,
		writes: () =>
			requests.filter((request: ApiRequest) => request.method !== "GET"),
	};
}

describe("ConfirmOccurrencePage", () => {
	it("fills the form with the recurring transaction, on its day", async () => {
		setUp();

		expect(
			await screen.findByText(
				"Hydro, due on Tuesday, November 10, 2026. Check the amount and the details, then record it.",
			),
		).toBeVisible();
		expect(screen.getByLabelText("Amount")).toHaveValue("90.00");
		expect(screen.getByLabelText("Tag")).toHaveValue(gas.id);
		expect(screen.getByLabelText("Date")).toHaveValue("2026-11-10");
		expect(screen.getByLabelText("Paid to (optional)")).toHaveValue("Hydro");
	});

	it("records it as the member changed it", async () => {
		const { user, onDone, writes } = setUp();

		const amount = await screen.findByLabelText("Amount");
		await user.clear(amount);
		await user.type(amount, "87.34");
		await user.click(
			screen.getByRole("button", { name: "Record the transaction" }),
		);

		await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
		expect(writes()).toEqual([
			{
				method: "POST",
				path: `${base}/recurring-transactions/pending/${OCCURRENCE}/confirm`,
				body: {
					type: "expense",
					accountId: chequing.id,
					date: "2026-11-10",
					note: null,
					payee: "Hydro",
					lines: [{ amount: 8_734, tagId: gas.id }],
				},
			},
		]);
	});

	it("fills a transfer's amount", async () => {
		setUp({
			...hydro,
			transaction: {
				...hydro.transaction,
				type: "transfer",
				toAccountId: savings.id,
				amount: 20_000,
				payee: null,
				lines: [],
			},
		});

		expect(await screen.findByLabelText("Amount")).toHaveValue("200.00");
		expect(screen.getByLabelText("To the account")).toHaveValue(savings.id);
	});

	it("skips it after a confirmation", async () => {
		const { user, onDone, writes } = setUp();

		await user.click(await screen.findByRole("button", { name: "Skip Hydro" }));
		await user.click(screen.getByRole("button", { name: "Skip" }));

		await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
		expect(writes()).toEqual([
			{
				method: "POST",
				path: `${base}/recurring-transactions/pending/${OCCURRENCE}/skip`,
				body: undefined,
			},
		]);
	});
});
