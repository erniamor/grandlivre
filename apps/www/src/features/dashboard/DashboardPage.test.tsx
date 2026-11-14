import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { setTestLocale } from "@/test/locale";
import { aliceProfile } from "@/test/mock-api";

describe("DashboardPage", () => {
	it.each([
		["en", "Dashboard"],
		["fr", "Tableau de bord"],
		["es", "Panel"],
	] as const)("greets the signed-in user, in %s", (locale, title) => {
		setTestLocale(locale);

		render(<DashboardPage me={aliceProfile} />);

		expect(
			screen.getByRole("heading", { level: 1, name: title }),
		).toBeVisible();
		expect(screen.getByText("Alice")).toBeVisible();
	});

	it("shows the email of a user without a name", () => {
		render(<DashboardPage me={{ ...aliceProfile, name: "" }} />);

		expect(screen.getByText("alice@example.com")).toBeVisible();
	});
});
