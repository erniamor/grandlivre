import type { Account, Household } from "@repo/schemas";
import { toast } from "@repo/ui";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	ACCOUNT_ID,
	BOB_ID,
	chequing,
	household,
	members,
	page,
} from "@/features/accounts/account-test-data";
import { EditAccountPage } from "@/features/accounts/EditAccountPage";
import {
	type ApiRequest,
	type ApiResponse,
	aliceProfile,
	mockApi,
} from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

afterEach(() => {
	vi.restoreAllMocks();
});

const base = `/households/${household.id}`;
const accountPath = `${base}/accounts/${ACCOUNT_ID}`;

interface Setup {
	account?: Account;
	role?: Household["role"];
	respond?: (request: ApiRequest) => ApiResponse | undefined;
}

function setUp({ account = chequing, role = "owner", respond }: Setup = {}) {
	const requests = mockApi((request) => {
		if (request.method !== "GET") {
			return respond?.(request) ?? { status: 200, body: account };
		}
		if (request.path === `${base}/members`) {
			return page(members);
		}
		if (request.path === accountPath) {
			return { status: 200, body: account };
		}
		// Refreshed after a change: the list and the summary
		return page([]);
	});
	const onDone = vi.fn();
	renderWithRouter(
		<EditAccountPage
			me={aliceProfile}
			household={{ ...household, role }}
			accountId={ACCOUNT_ID}
			onDone={onDone}
		/>,
	);
	return {
		user: userEvent.setup(),
		onDone,
		/** The requests that change something, without the reads. */
		writes: () => requests.filter((request) => request.method !== "GET"),
	};
}

describe("EditAccountPage", () => {
	it("shows the account as it is", async () => {
		setUp();

		expect(await screen.findByLabelText("Account name")).toHaveValue(
			"Everyday",
		);
		expect(screen.getByLabelText("Type")).toHaveValue("checking");
		expect(screen.getByLabelText("Opening balance")).toHaveValue("1250.50");
		expect(screen.getByRole("checkbox", { name: "Alice" })).toBeChecked();
		expect(screen.getByRole("checkbox", { name: "Bob" })).not.toBeChecked();
		expect(screen.getByLabelText("What the other members see")).toHaveValue(
			"details",
		);
	});

	it("shows a debt as the amount owed", async () => {
		setUp({
			account: {
				...chequing,
				type: "credit_card",
				balance: -45_000,
				openingBalance: -45_000,
			},
		});

		expect(await screen.findByLabelText("Amount owed")).toHaveValue("450.00");
	});

	it("saves the changes, then leaves", async () => {
		const success = vi.spyOn(toast, "success").mockImplementation(() => "");
		const { user, onDone, writes } = setUp();

		const name = await screen.findByLabelText("Account name");
		await user.clear(name);
		await user.type(name, "Joint");
		await user.click(screen.getByRole("checkbox", { name: "Bob" }));
		await user.click(screen.getByRole("button", { name: "Save" }));

		await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
		expect(writes()).toEqual([
			{
				method: "PATCH",
				path: accountPath,
				body: {
					name: "Joint",
					type: "checking",
					visibility: "details",
					holderIds: [aliceProfile.id, BOB_ID],
					openingBalance: 125_050,
				},
			},
		]);
		expect(success).toHaveBeenCalledWith("The account was saved.");
	});

	it("lets a holder hand the account over to another member", async () => {
		const { user, onDone, writes } = setUp();

		await user.click(await screen.findByRole("checkbox", { name: "Bob" }));
		await user.click(screen.getByRole("checkbox", { name: "Alice" }));
		await user.click(screen.getByRole("button", { name: "Save" }));

		await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
		expect(writes()).toMatchObject([{ body: { holderIds: [BOB_ID] } }]);
	});

	it("refuses an account without a holder, without calling the API", async () => {
		const { user, onDone, writes } = setUp();

		await user.click(await screen.findByRole("checkbox", { name: "Alice" }));
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(
			await screen.findByText("Choose at least one holder."),
		).toBeVisible();
		expect(writes()).toEqual([]);
		expect(onDone).not.toHaveBeenCalled();
	});

	it("deletes the account after a confirmation, then leaves", async () => {
		const success = vi.spyOn(toast, "success").mockImplementation(() => "");
		const { user, onDone, writes } = setUp({
			respond: () => ({ status: 204 }),
		});

		await user.click(
			await screen.findByRole("button", { name: "Delete the account" }),
		);
		expect(writes()).toEqual([]);
		const dialog = within(
			screen.getByRole("alertdialog", { name: "Delete Everyday?" }),
		);
		await user.click(dialog.getByRole("button", { name: "Delete" }));

		await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
		expect(writes()).toEqual([
			{ method: "DELETE", path: accountPath, body: undefined },
		]);
		expect(success).toHaveBeenCalledWith("The account was deleted.");
	});

	it("shows no form to a member who doesn't hold the account", async () => {
		setUp({
			account: {
				...chequing,
				holders: [{ userId: BOB_ID, name: "Bob" }],
				isHolder: false,
			},
		});

		expect(
			await screen.findByText(
				"Everyday · Only the holders of this account can change it.",
			),
		).toBeVisible();
		expect(screen.queryByLabelText("Account name")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Delete the account" }),
		).not.toBeInTheDocument();
	});

	describe("for an account without a holder", () => {
		const orphan: Account = {
			...chequing,
			visibility: "balance",
			openingBalance: null,
			holders: [],
			isHolder: false,
		};

		it("lets an owner of the household give it a holder, without touching its balance", async () => {
			const { user, onDone, writes } = setUp({ account: orphan });

			await user.click(await screen.findByRole("checkbox", { name: "Bob" }));
			expect(
				screen.queryByLabelText("Opening balance"),
			).not.toBeInTheDocument();
			await user.click(screen.getByRole("button", { name: "Save" }));

			await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
			expect(writes()).toEqual([
				{
					method: "PATCH",
					path: accountPath,
					body: {
						name: "Everyday",
						type: "checking",
						visibility: "balance",
						holderIds: [BOB_ID],
					},
				},
			]);
		});

		it("shows no form to a plain member", async () => {
			setUp({ account: orphan, role: "member" });

			expect(
				await screen.findByText(
					"Everyday · Only the holders of this account can change it.",
				),
			).toBeVisible();
			expect(screen.queryByLabelText("Account name")).not.toBeInTheDocument();
		});
	});
});
