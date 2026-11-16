import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppearanceMenu } from "@/features/appearance/AppearanceMenu";
import { readCookie } from "@/lib/cookies";
import { setTestLocale } from "@/test/locale";
import { mockSystemAppearance } from "@/test/match-media";

afterEach(() => {
	vi.unstubAllGlobals();
	document.documentElement.classList.remove("dark");
	delete document.documentElement.dataset.theme;
});

describe("AppearanceMenu", () => {
	it("offers the modes and the themes", async () => {
		setTestLocale("fr");
		const user = userEvent.setup();
		render(<AppearanceMenu initialAppearance="system" initialTheme="dusk" />);

		await user.click(
			screen.getByRole("button", { name: "Apparence : Système, Crépuscule" }),
		);

		const modes = screen.getByRole("group", { name: "Mode" });
		expect(
			within(modes)
				.getAllByRole("menuitemradio")
				.map((item) => item.textContent),
		).toEqual(["Claire", "Sombre", "Système"]);
		const themes = screen.getByRole("group", { name: "Thème" });
		expect(
			within(themes)
				.getAllByRole("menuitemradio")
				.map((item) => item.textContent),
		).toEqual(["Registre", "Framboise", "Crépuscule", "Encre", "Agrumes"]);
		expect(
			within(themes).getByRole("menuitemradio", { name: "Crépuscule" }),
		).toHaveAttribute("aria-checked", "true");
	});

	it("applies a theme at once and remembers it, keeping the mode", async () => {
		mockSystemAppearance(false);
		const user = userEvent.setup();
		render(<AppearanceMenu initialAppearance="dark" initialTheme="ledger" />);

		await user.click(
			screen.getByRole("button", { name: "Appearance: Dark, Ledger" }),
		);
		await user.click(screen.getByRole("menuitemradio", { name: "Dusk" }));

		expect(document.documentElement.dataset.theme).toBe("dusk");
		expect(readCookie(document.cookie, "theme")).toBe("dusk");
		expect(
			screen.getByRole("button", { name: "Appearance: Dark, Dusk" }),
		).toBeInTheDocument();
	});
});
