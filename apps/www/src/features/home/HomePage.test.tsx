import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomePage } from "@/features/home/HomePage";
import { setTestLocale } from "@/test/locale";
import { renderWithRouter } from "@/test/render-with-router";

describe("HomePage", () => {
	it.each([
		["en", "Your family's finances, in one place", "Sign in"],
		["fr", "Les finances de la famille, au même endroit", "Se connecter"],
		["es", "Las finanzas de la familia, en un solo lugar", "Iniciar sesión"],
	] as const)(
		"invites a visitor to sign in, in %s",
		async (locale, title, link) => {
			setTestLocale(locale);

			renderWithRouter(<HomePage />);

			expect(
				await screen.findByRole("heading", { level: 1, name: title }),
			).toBeVisible();
			expect(screen.getByRole("link", { name: link })).toHaveAttribute(
				"href",
				"/sign-in",
			);
		},
	);
});
