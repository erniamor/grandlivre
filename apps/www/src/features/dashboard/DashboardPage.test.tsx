import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { setTestLocale } from "@/test/locale";
import { aliceProfile } from "@/test/mock-api";

const household = {
	id: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
	name: "The Tremblays",
	currency: "CAD",
	role: "owner",
	createdAt: "2026-11-14T12:00:00.000Z",
} as const;

describe("DashboardPage", () => {
	it.each([
		["en", "Dashboard", "Household: The Tremblays"],
		["fr", "Tableau de bord", "Foyer : The Tremblays"],
		["es", "Panel", "Hogar: The Tremblays"],
	] as const)(
		"greets the signed-in user in their household, in %s",
		(locale, title, householdLine) => {
			setTestLocale(locale);

			render(<DashboardPage me={aliceProfile} household={household} />);

			expect(
				screen.getByRole("heading", { level: 1, name: title }),
			).toBeVisible();
			expect(screen.getByText("Alice")).toBeVisible();
			expect(screen.getByText(householdLine)).toBeVisible();
		},
	);

	it("shows the email of a user without a name", () => {
		render(
			<DashboardPage
				me={{ ...aliceProfile, name: "" }}
				household={household}
			/>,
		);

		expect(screen.getByText("alice@example.com")).toBeVisible();
	});
});
