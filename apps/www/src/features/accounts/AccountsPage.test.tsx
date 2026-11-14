import type { Account, Household } from "@repo/schemas";
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountsPage } from "@/features/accounts/AccountsPage";
import { setTestLocale } from "@/test/locale";
import { aliceProfile, mockApi } from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

const NOW = "2026-11-14T12:00:00.000Z";

const household: Household = {
	id: "7d6c5b4a-3f2e-4d1c-8b0a-9f8e7d6c5b4a",
	name: "The Tremblays",
	currency: "CAD",
	role: "owner",
	createdAt: NOW,
};

const ALICE = { userId: aliceProfile.id, name: "Alice" };
const BOB = { userId: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d", name: "Bob" };

let nextId = 0;

function account(fields: Partial<Account> & { name: string }): Account {
	nextId += 1;
	return {
		id: `00000000-0000-4000-8000-${String(nextId).padStart(12, "0")}`,
		householdId: household.id,
		type: "checking",
		visibility: "details",
		balance: 0,
		openingBalance: 0,
		holders: [ALICE],
		isHolder: true,
		createdAt: NOW,
		...fields,
	};
}

const accounts = [
	account({ name: "Everyday", balance: 125_050 }),
	account({
		name: "Joint",
		type: "savings",
		holders: [ALICE, BOB],
		balance: 1_000_000,
	}),
	account({
		name: "Bob's Visa",
		type: "credit_card",
		visibility: "balance",
		holders: [BOB],
		isHolder: false,
		balance: -45_000,
		openingBalance: null,
	}),
	account({ name: "Old account", holders: [], isHolder: false, balance: 100 }),
];

function setUp(items: Account[] = accounts) {
	mockApi((request) => {
		if (request.path.endsWith("/accounts/summary")) {
			return {
				status: 200,
				body: { assets: 1_125_150, liabilities: -45_000, balance: 1_080_150 },
			};
		}
		if (request.path.endsWith("/accounts")) {
			return {
				status: 200,
				body: {
					data: items,
					pagination: { page: 1, pageSize: 100, total: items.length },
				},
			};
		}
		return undefined;
	});
	renderWithRouter(<AccountsPage household={household} />);
}

async function group(name: string) {
	return within(await screen.findByRole("region", { name }));
}

describe("AccountsPage", () => {
	it.each([
		["en", "Accounts", "My accounts", "Shared accounts", "$1,250.50"],
		["fr", "Comptes", "Mes comptes", "Comptes communs", "1 250,50 $"],
		["es", "Cuentas", "Mis cuentas", "Cuentas compartidas", "1250,50 $"],
	] as const)(
		"lists the household's accounts with their balance, in %s",
		async (locale, title, mineTitle, sharedTitle, balance) => {
			setTestLocale(locale);
			setUp();

			expect(
				await screen.findByRole("heading", { level: 1, name: title }),
			).toBeVisible();
			const mine = await group(mineTitle);
			expect(mine.getByText("Everyday")).toBeVisible();
			expect(mine.getByText(balance)).toBeVisible();
			expect((await group(sharedTitle)).getByText("Joint")).toBeVisible();
		},
	);

	it("groups the accounts by what they are to the user", async () => {
		setUp();

		const mine = await group("My accounts");
		const shared = await group("Shared accounts");
		const others = await group("Other accounts of the household");

		expect(mine.getAllByRole("listitem")).toHaveLength(1);
		expect(shared.getAllByRole("listitem")).toHaveLength(1);
		expect(others.getAllByRole("listitem")).toHaveLength(2);
		expect(others.getByText("Bob's Visa")).toBeVisible();
	});

	it("names the type of each account, and the holders of those that aren't the user's alone", async () => {
		setUp();

		const mine = await group("My accounts");
		const shared = await group("Shared accounts");
		const others = await group("Other accounts of the household");

		// The user's own accounts don't repeat their name
		expect(mine.getByText("Chequing")).toBeVisible();
		expect(shared.getByText("Savings · Held by Alice and Bob")).toBeVisible();
		expect(others.getByText("Credit card · Held by Bob")).toBeVisible();
		expect(others.getByText("Chequing · No holder")).toBeVisible();
	});

	it("shows money owed as a negative balance", async () => {
		setUp();

		const others = await group("Other accounts of the household");

		expect(others.getByText("-$450.00")).toBeVisible();
	});

	it("shows the household's consolidated balance", async () => {
		setUp();

		const balance = await group("Household balance");

		expect(balance.getByText("$10,801.50")).toBeVisible();
		expect(balance.getByText("Assets")).toBeVisible();
		expect(balance.getByText("$11,251.50")).toBeVisible();
		expect(balance.getByText("Debts")).toBeVisible();
		expect(balance.getByText("-$450.00")).toBeVisible();
	});

	it("says when the household has no account yet", async () => {
		setUp([]);

		expect(await screen.findByText("No account yet.")).toBeVisible();
		expect(
			screen.queryByRole("region", { name: "My accounts" }),
		).not.toBeInTheDocument();
	});
});
