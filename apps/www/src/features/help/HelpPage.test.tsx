import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HelpPage } from "@/features/help/HelpPage";
import { setTestLocale } from "@/test/locale";
import { renderWithRouter } from "@/test/render-with-router";

describe("HelpPage", () => {
	it("lists its sections, each reached from the contents", async () => {
		renderWithRouter(<HelpPage />);

		expect(
			await screen.findByRole("heading", { level: 1, name: "Help" }),
		).toBeVisible();
		const contents = within(
			screen.getByRole("navigation", { name: "Contents" }),
		);
		expect(
			contents.getByRole("link", { name: "Importing a statement" }),
		).toHaveAttribute("href", "/help#imports");
		expect(
			contents.getByRole("link", { name: "Questions asked often" }),
		).toHaveAttribute("href", "/help#faq");
		const imports = screen.getByRole("region", {
			name: "Importing a statement",
		});
		expect(imports).toHaveAttribute("id", "imports");
		expect(within(imports).getByText(/then forgotten/)).toBeVisible();
	});

	it("opens a question's answer on demand", async () => {
		renderWithRouter(<HelpPage />);
		const user = userEvent.setup();
		const answer = await screen.findByText(
			/a transfer from your account to your wallet/,
		);

		expect(answer).not.toBeVisible();
		await user.click(screen.getByText("I took cash out: is it an expense?"));
		expect(answer).toBeVisible();
	});

	it("searches the questions, accents and case aside, and says how many are left", async () => {
		setTestLocale("fr");
		renderWithRouter(<HelpPage />);
		const user = userEvent.setup();
		const faq = within(
			await screen.findByRole("region", { name: "Questions fréquentes" }),
		);

		await user.type(
			faq.getByRole("searchbox", { name: "Chercher dans les questions" }),
			"DEVISE",
		);

		expect(faq.getByText("Questions : 1")).toBeVisible();
		expect(faq.getByText("Comment changer la devise du foyer ?")).toBeVisible();
		await user.clear(faq.getByRole("searchbox"));
		await user.type(faq.getByRole("searchbox"), "zzz");
		expect(
			faq.getByText("Aucune question ne correspond : essayez d'autres mots."),
		).toBeVisible();
	});
});
