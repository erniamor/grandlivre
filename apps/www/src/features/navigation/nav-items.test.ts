import { describe, expect, it } from "vitest";
import { isUnder, navItems, tabLabel } from "@/features/navigation/nav-items";
import { household } from "@/features/transactions/transaction-test-data";
import { setTestLocale } from "@/test/locale";

describe("navItems", () => {
	it("offers the sharing page only to a household that settles shared expenses", () => {
		const paths = (sharing: boolean) =>
			navItems({ ...household, expenseSharing: sharing }).map(({ to }) => to);

		expect(paths(false)).not.toContain("/shared");
		expect(paths(true)).toContain("/shared");
		expect(navItems(null).map(({ to }) => to)).not.toContain("/shared");
	});

	it("puts three pages in the tab bar, the dashboard under a shorter name", () => {
		setTestLocale("fr");

		expect(
			navItems(household)
				.filter((item) => item.tab)
				.map(tabLabel),
		).toEqual(["Accueil", "Transactions", "Rapports"]);
	});
});

describe("isUnder", () => {
	it("holds a page and the ones under it, not a page whose path only starts the same", () => {
		const [dashboard, transactions] = navItems(household);
		if (!dashboard || !transactions) {
			throw new Error("The pages are missing");
		}

		expect(isUnder(transactions, "/transactions")).toBe(true);
		expect(isUnder(transactions, "/transactions/new")).toBe(true);
		expect(isUnder(dashboard, "/dashboards")).toBe(false);
	});
});
