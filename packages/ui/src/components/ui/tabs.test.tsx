import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

function Accounts() {
	return (
		<Tabs defaultValue="chequing">
			<TabsList aria-label="Accounts">
				<TabsTrigger value="chequing">Chequing</TabsTrigger>
				<TabsTrigger value="card">Card</TabsTrigger>
			</TabsList>
			<TabsContent value="chequing">Chequing lines</TabsContent>
			<TabsContent value="card">Card lines</TabsContent>
		</Tabs>
	);
}

describe("Tabs", () => {
	it("shows one panel at a time, chosen by click or with the arrow keys", async () => {
		const user = userEvent.setup();
		render(<Accounts />);

		expect(screen.getByRole("tab", { name: "Chequing" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(screen.getByRole("tabpanel")).toHaveTextContent("Chequing lines");

		await user.click(screen.getByRole("tab", { name: "Card" }));
		expect(screen.getByRole("tabpanel")).toHaveTextContent("Card lines");

		await user.keyboard("{ArrowLeft}");
		expect(screen.getByRole("tab", { name: "Chequing" })).toHaveFocus();
		expect(screen.getByRole("tabpanel")).toHaveTextContent("Chequing lines");
	});
});
