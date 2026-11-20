import type { Tag } from "@repo/schemas";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TagPicker } from "@/features/tags/TagPicker";
import { buildTagTree } from "@/features/tags/tag-tree";
import { renderWithQueryClient } from "@/test/render-with-router";

afterEach(() => {
	vi.unstubAllGlobals();
});

function tag(
	id: string,
	names: Tag["names"],
	parentId: string | null = null,
): Tag {
	return {
		id,
		householdId: "household",
		names,
		parentId,
		createdAt: "2026-11-14T12:00:00.000Z",
	};
}

const tags = [
	tag("home", { en: "Home" }),
	tag("home-insurance", { en: "Insurance" }, "home"),
	tag("internet", { en: "Internet" }, "home"),
	tag("fiber", { en: "Fiber" }, "internet"),
	tag("car", { en: "Car" }),
	tag("car-insurance", { en: "Insurance" }, "car"),
];

function setUp(value: string | null = null, noneLabel?: string) {
	const onChange = vi.fn();
	renderWithQueryClient(
		<TagPicker
			label="Tag for COSTCO"
			tree={buildTagTree(tags, "en")}
			value={value}
			onChange={onChange}
			placeholder="Choose a tag"
			noneLabel={noneLabel}
		/>,
	);
	return { onChange, user: userEvent.setup() };
}

/** A wide screen: the picker opens under its button. */
function wideScreen() {
	vi.stubGlobal(
		"matchMedia",
		vi.fn((query: string) => ({
			matches: query === "(min-width: 48rem)",
			media: query,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		})),
	);
}

describe("TagPicker", () => {
	it("shows the tag chosen with its path, or what to do without one", () => {
		setUp("fiber");

		expect(
			screen.getByRole("button", {
				name: "Tag for COSTCO: Home › Internet › Fiber",
			}),
		).toHaveAttribute("aria-haspopup", "dialog");
	});

	it("goes down the levels, chooses a tag at the bottom, and closes", async () => {
		const { onChange, user } = setUp();

		await user.click(
			screen.getByRole("button", { name: "Tag for COSTCO: Choose a tag" }),
		);
		const picker = within(
			screen.getByRole("dialog", { name: "Tag for COSTCO" }),
		);
		await user.click(
			picker.getByRole("button", { name: "Home, shows its tags" }),
		);
		await user.click(
			picker.getByRole("button", { name: "Internet, shows its tags" }),
		);
		expect(
			picker
				.getByRole("navigation", { name: "Path" })
				.querySelector('[aria-current="location"]'),
		).toHaveTextContent("Internet");
		await user.click(picker.getByRole("button", { name: "Fiber" }));

		expect(onChange).toHaveBeenCalledWith("fiber");
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("chooses a tag that has child tags from the first row of its level", async () => {
		const { onChange, user } = setUp();

		await user.click(screen.getByRole("button", { name: /^Tag for COSTCO/ }));
		await user.click(
			screen.getByRole("button", { name: "Home, shows its tags" }),
		);
		await user.click(screen.getByRole("button", { name: "Choose “Home”" }));

		expect(onChange).toHaveBeenCalledWith("home");
	});

	it("goes back up, one level or to the top", async () => {
		const { user } = setUp("fiber");

		await user.click(screen.getByRole("button", { name: /^Tag for COSTCO/ }));
		// Opened on the level of the tag chosen, marked
		expect(
			screen.getByRole("button", { name: "Fiber, chosen" }),
		).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Back to Home" }));
		expect(
			screen.getByRole("button", { name: "Internet, shows its tags" }),
		).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "All tags" }));

		expect(
			screen.getByRole("button", { name: "Car, shows its tags" }),
		).toBeInTheDocument();
		expect(screen.queryByRole("navigation", { name: "Path" })).toBeNull();
	});

	it("searches every level, each tag with its path", async () => {
		const { onChange, user } = setUp();

		await user.click(screen.getByRole("button", { name: /^Tag for COSTCO/ }));
		await user.type(
			screen.getByRole("searchbox", { name: "Search a tag" }),
			"insu",
		);

		const picker = within(screen.getByRole("dialog"));
		expect(
			picker.getAllByRole("listitem").map((item) => item.textContent),
		).toEqual(["Car › Insurance", "Home › Insurance"]);
		await user.click(picker.getByRole("button", { name: "Home › Insurance" }));
		expect(onChange).toHaveBeenCalledWith("home-insurance");
	});

	it("says when nothing matches", async () => {
		const { user } = setUp();

		await user.click(screen.getByRole("button", { name: /^Tag for COSTCO/ }));
		await user.type(screen.getByRole("searchbox"), "zzz");

		expect(screen.getByText("No tag matches “zzz”.")).toBeVisible();
	});

	it("offers no tag at the top, where the field allows it", async () => {
		const { onChange, user } = setUp("car", "Uncategorized");

		await user.click(
			screen.getByRole("button", { name: "Tag for COSTCO: Car" }),
		);
		await user.click(screen.getByRole("button", { name: "Uncategorized" }));

		expect(onChange).toHaveBeenCalledWith(null);
	});

	it("opens in a panel on a phone without the cursor in the search, so no keyboard covers the list", async () => {
		const { user } = setUp();

		await user.click(screen.getByRole("button", { name: /^Tag for COSTCO/ }));

		expect(
			await screen.findByRole("dialog", { name: "Tag for COSTCO" }),
		).toHaveFocus();
		const search = screen.getByRole("searchbox", { name: "Search a tag" });
		expect(search).not.toHaveFocus();
		await user.tab();
		expect(search).toHaveFocus();
	});

	it("opens under its button on a wide screen, without the cursor in the search", async () => {
		wideScreen();
		const { user } = setUp();

		await user.click(screen.getByRole("button", { name: /^Tag for COSTCO/ }));

		expect(
			screen.getByRole("dialog", { name: "Tag for COSTCO" }),
		).toBeVisible();
		expect(
			screen.getByRole("searchbox", { name: "Search a tag" }),
		).not.toHaveFocus();
		expect(
			screen.getByRole("dialog", { name: "Tag for COSTCO" }),
		).toHaveFocus();
		// No close button: a click outside or Escape closes it
		expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
		await user.keyboard("{Escape}");
		expect(screen.queryByRole("dialog")).toBeNull();
	});
});
