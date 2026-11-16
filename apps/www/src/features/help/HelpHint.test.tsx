import { TooltipProvider } from "@repo/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HelpHint } from "@/features/help/HelpHint";
import { helpTopics } from "@/features/help/help-topics";
import { setTestLocale } from "@/test/locale";

function renderHint(topic: Parameters<typeof HelpHint>[0]["topic"]) {
	render(
		<TooltipProvider>
			<HelpHint topic={topic} />
		</TooltipProvider>,
	);
	return userEvent.setup();
}

describe("HelpHint", () => {
	it("opens its explanation on a click, named after the question it answers", async () => {
		const user = renderHint("accountVisibility");

		expect(screen.queryByText("Visibility")).not.toBeInTheDocument();
		await user.click(
			screen.getByRole("button", { name: "What does the visibility change?" }),
		);

		expect(screen.getByText("Visibility")).toBeVisible();
		expect(
			screen.getByText(/What the other members see of this account/),
		).toBeVisible();
	});

	it("closes with Escape, the focus back on its button", async () => {
		const user = renderHint("transfer");
		const button = screen.getByRole("button", {
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
