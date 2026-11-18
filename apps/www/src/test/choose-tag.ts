import { screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

/**
 * Opens a tag field's picker and chooses `name` among the tags of its first
 * level (or "Uncategorized", or a tag proposed), as a member would.
 */
export async function chooseTag(
	user: UserEvent,
	field: HTMLElement,
	name: string,
): Promise<void> {
	await user.click(field);
	const picker = within(await screen.findByRole("dialog"));
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	// The tag already chosen is named so too
	await user.click(
		picker.getByRole("button", { name: new RegExp(`^${escaped}(, chosen)?$`) }),
	);
}

/** The choices a tag field's picker offers first, by their names: opened, read, then closed. */
export async function firstTagChoices(
	user: UserEvent,
	field: HTMLElement,
): Promise<string[]> {
	await user.click(field);
	const picker = within(await screen.findByRole("dialog"));
	const names = picker
		.getAllByRole("listitem")
		.map((item) => item.textContent ?? "");
	await user.keyboard("{Escape}");
	return names;
}
