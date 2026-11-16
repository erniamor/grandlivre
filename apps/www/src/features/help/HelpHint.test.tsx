import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HelpHint } from "@/features/help/HelpHint";
import { helpTopics } from "@/features/help/help-topics";
import { setTestLocale } from "@/test/locale";
import { renderWithRouter } from "@/test/render-with-router";

function renderHint(topic: Parameters<typeof HelpHint>[0]["topic"]) {
	renderWithRouter(<HelpHint topic={topic} />);
	return userEvent.setup();
}

describe("HelpHint", () => {
	it("opens its explanation on a click, named after the question it answers", async () => {
		const user = renderHint("accountVisibility");

		expect(screen.queryByText("Visibility")).not.toBeInTheDocument();
		await user.click(
			await screen.findByRole("button", {
				name: "What does the visibility change?",
			}),
		);

		expect(screen.getByText("Visibility")).toBeVisible();
		expect(
			screen.getByText(/What the other members see of this account/),
		).toBeVisible();
		expect(screen.getByRole("link", { name: "Learn more" })).toHaveAttribute(
			"href",
			"/help#accounts",
		);
	});

	it("closes with Escape, the focus back on its button", async () => {
		const user = renderHint("transfer");
		const button = await screen.findByRole("button", {
			name: "Expense, income or transfer?",
		});

		await user.click(button);
		await user.keyboard("{Escape}");

		expect(
			screen.queryByText(/is money leaving or entering the household/),
		).not.toBeInTheDocument();
		expect(button).toHaveFocus();
	});

	it.each(["en", "fr", "es"] as const)(
		"says something of every notion, in %s",
		(locale) => {
			setTestLocale(locale);

			for (const { label, title, text } of Object.values(helpTopics)) {
				for (const message of [label(), title(), text()]) {
					expect(message.trim()).not.toBe("");
				}
			}
		},
	);
});
