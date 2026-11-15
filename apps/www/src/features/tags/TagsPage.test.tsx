import type { Tag } from "@repo/schemas";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagsPage } from "@/features/tags/TagsPage";
import {
	base,
	car,
	home,
	household,
	tags,
	tagsPage,
} from "@/features/tags/tag-test-data";
import { setTestLocale } from "@/test/locale";
import { mockApi } from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

function setUp(initial: Tag[] = tags) {
	let current = initial;
	const requests = mockApi((request) => {
		if (request.method === "GET" && request.path === base) {
			return tagsPage(current);
		}
		if (request.method === "POST" && request.path === `${base}/suggested`) {
			current = tags;
			return { status: 204 };
		}
		return undefined;
	});
	renderWithRouter(<TagsPage household={household} />);
	return { user: userEvent.setup(), requests };
}

/** The names shown directly in a list, without those of nested lists. */
function namesIn(list: HTMLElement): (string | null)[] {
	return within(list)
		.getAllByRole("listitem")
		.filter((item) => item.parentElement === list)
		.map((item) => item.querySelector("span")?.textContent ?? null);
}

describe("TagsPage", () => {
	it.each([
		["en", "Tags", ["Car", "Home"]],
		["fr", "Tags", ["Maison", "Voiture"]],
		["es", "Etiquetas", ["Car", "Hogar"]],
	] as const)(
		"shows the tags in the user's language, sorted by name, in %s",
		async (locale, title, roots) => {
			setTestLocale(locale);
			setUp();

			expect(
				await screen.findByRole("heading", { level: 1, name: title }),
			).toBeVisible();
			expect(namesIn(screen.getByRole("list", { name: title }))).toEqual(roots);
		},
	);

	it("nests the tags under their parent, at any depth", async () => {
		setUp();

		const tree = await screen.findByRole("list", { name: "Tags" });
		const homeItem = within(tree).getByText("Home").closest("li");
		const internetItem = within(tree).getByText("Internet").closest("li");

		expect(homeItem).toContainElement(internetItem);
		expect(internetItem).toContainElement(within(tree).getByText("Fiber"));
		expect(homeItem).not.toContainElement(within(tree).getByText("Car"));
	});

	it("shows a tag without a name in the user's language under another language's", async () => {
		setUp();

		expect(await screen.findByText("Essence")).toBeVisible();
	});

	it("links each tag to its form, and to a new sub-tag under it", async () => {
		setUp();

		expect(
			await screen.findByRole("link", { name: "Edit Home" }),
		).toHaveAttribute("href", `/tags/${home.id}`);
		expect(
			screen.getByRole("link", { name: "Add a sub-tag to Car" }),
		).toHaveAttribute("href", `/tags/new?parent=${car.id}`);
		expect(screen.getByRole("link", { name: "Add a tag" })).toHaveAttribute(
			"href",
			"/tags/new",
		);
	});

	it("offers the suggested tags to a household without tags, then shows them", async () => {
		const { user, requests } = setUp([]);

		expect(await screen.findByText("No tag yet.")).toBeVisible();
		await user.click(
			screen.getByRole("button", { name: "Add the suggested tags" }),
		);

		expect(await screen.findByText("Home")).toBeVisible();
		expect(requests).toContainEqual({
			method: "POST",
			path: `${base}/suggested`,
			body: undefined,
		});
		expect(
			screen.queryByRole("button", { name: "Add the suggested tags" }),
		).not.toBeInTheDocument();
	});

	it("doesn't offer the suggested tags once the household has tags", async () => {
		setUp();

		await screen.findByText("Home");
		expect(
			screen.queryByRole("button", { name: "Add the suggested tags" }),
		).not.toBeInTheDocument();
	});
});
