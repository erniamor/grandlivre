import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetTitle,
	SheetTrigger,
} from "@repo/ui/components/ui/sheet";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

function Pages() {
	return (
		<Sheet>
			<SheetTrigger>More</SheetTrigger>
			<SheetContent side="bottom" showCloseButton={false}>
				<SheetTitle>Other pages</SheetTitle>
				<SheetDescription>Everything else.</SheetDescription>
				<SheetClose>Done</SheetClose>
			</SheetContent>
		</Sheet>
	);
}

describe("Sheet", () => {
	it("opens with its title, and closes with its button or Escape", async () => {
		const user = userEvent.setup();
		render(<Pages />);

		await user.click(screen.getByRole("button", { name: "More" }));
		expect(
			screen.getByRole("dialog", { name: "Other pages" }),
		).toHaveAccessibleDescription("Everything else.");
		await user.click(screen.getByRole("button", { name: "Done" }));
		expect(screen.queryByRole("dialog")).toBeNull();

		await user.click(screen.getByRole("button", { name: "More" }));
		await user.keyboard("{Escape}");
		expect(screen.queryByRole("dialog")).toBeNull();
	});
});
