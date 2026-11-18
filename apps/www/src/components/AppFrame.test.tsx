import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppFrame } from "@/components/AppFrame";
import { renderWithRouter } from "@/test/render-with-router";

describe("AppFrame", () => {
	it("offers a signed-in user the app's pages, at the side and at the bottom", async () => {
		renderWithRouter(
			<AppFrame signedIn>
				<p>Page</p>
			</AppFrame>,
		);

		expect(await screen.findByRole("main")).toHaveTextContent("Page");
		// One shows by the screen's width: the side bar from a tablet up
		expect(screen.getAllByRole("navigation", { name: "Main" })).toHaveLength(2);
	});

	it("shows a visitor the page alone: the app's pages are reserved to members", async () => {
		renderWithRouter(
			<AppFrame signedIn={false}>
				<p>Page</p>
			</AppFrame>,
		);

		expect(await screen.findByRole("main")).toHaveTextContent("Page");
		expect(screen.queryByRole("navigation")).toBeNull();
	});
});
