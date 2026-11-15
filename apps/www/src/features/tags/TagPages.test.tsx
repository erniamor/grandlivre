import { toast } from "@repo/ui";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditTagPage } from "@/features/tags/EditTagPage";
import { NewTagPage } from "@/features/tags/NewTagPage";
import {
	base,
	car,
	fiber,
	gas,
	home,
	household,
	internet,
	tags,
	tagsPage,
} from "@/features/tags/tag-test-data";
import { setTestLocale } from "@/test/locale";
import { type ApiRequest, type ApiResponse, mockApi } from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

afterEach(() => {
	vi.restoreAllMocks();
});

type Respond = (request: ApiRequest) => ApiResponse | undefined;

function mockTags(respond: Respond = () => ({ status: 200, body: gas })) {
	const requests = mockApi((request) =>
		request.method === "GET" ? tagsPage(tags) : respond(request),
	);
	/** The requests that change something, without the reads. */
	return () => requests.filter((request) => request.method !== "GET");
}

function renderNew(respond?: Respond, parentId?: string) {
	const writes = mockTags(respond);
	const onCreated = vi.fn();
	renderWithRouter(
		<NewTagPage
			household={household}
			parentId={parentId}
			onCreated={onCreated}
		/>,
	);
	return { user: userEvent.setup(), onCreated, writes };
}

function renderEdit(tagId: string, respond?: Respond) {
	const writes = mockTags(respond);
	const onDone = vi.fn();
	renderWithRouter(
		<EditTagPage household={household} tagId={tagId} onDone={onDone} />,
	);
	return { user: userEvent.setup(), onDone, writes };
}

const optionLabels = (select: HTMLElement) =>
	within(select)
		.getAllByRole("option")
		.map((option) => option.textContent);

describe("NewTagPage", () => {
	it("asks for the name in the user's language first", async () => {
		setTestLocale("fr");
		renderNew();

		await screen.findByRole("heading", { level: 1, name: "Nouveau tag" });
		expect(
			screen.getAllByRole("textbox").map((field) => field.getAttribute("lang")),
		).toEqual(["fr", "en", "es"]);
	});

	it("creates a tag at the top, named in one language only", async () => {
		const success = vi.spyOn(toast, "success").mockImplementation(() => "");
		const { user, onCreated, writes } = renderNew();

		await user.type(await screen.findByLabelText("English"), " Leisure ");
		await user.click(screen.getByRole("button", { name: "Create the tag" }));

		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(writes()).toEqual([
			{
				method: "POST",
				path: base,
				body: { names: { en: "Leisure" }, parentId: null },
			},
		]);
		expect(success).toHaveBeenCalledWith("The tag was created.");
	});

	it("creates a tag named in several languages, under the parent chosen", async () => {
		const { user, onCreated, writes } = renderNew();

		await user.type(await screen.findByLabelText("English"), "Insurance");
		await user.type(screen.getByLabelText("Français"), "Assurance");
		await user.selectOptions(screen.getByLabelText("Parent tag"), "Car");
		await user.click(screen.getByRole("button", { name: "Create the tag" }));

		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(writes()).toMatchObject([
			{
				body: {
					names: { en: "Insurance", fr: "Assurance" },
					parentId: car.id,
				},
			},
		]);
	});

	it("proposes the parent it was opened from, and every tag with its path", async () => {
		renderNew(undefined, internet.id);

		const parent = await screen.findByLabelText("Parent tag");

		expect(parent).toHaveValue(internet.id);
		expect(optionLabels(parent)).toEqual([
			"None: at the top",
			"Car",
			"Car › Essence",
			"Home",
			"Home › Internet",
			"Home › Internet › Fiber",
		]);
	});

	it("starts at the top when the parent it was opened from no longer exists", async () => {
		renderNew(undefined, "00000000-0000-4000-8000-999999999999");

		expect(await screen.findByLabelText("Parent tag")).toHaveValue("");
	});

	it("asks for a name in at least one language before calling the API", async () => {
		const { user, onCreated, writes } = renderNew();

		await user.click(
			await screen.findByRole("button", { name: "Create the tag" }),
		);

		expect(
			await screen.findByText("Enter a name in at least one language."),
		).toBeVisible();
		expect(writes()).toEqual([]);
		expect(onCreated).not.toHaveBeenCalled();
	});

	it("says which name another tag already has, next to its language", async () => {
		const { user, onCreated } = renderNew(() => ({
			status: 422,
			body: {
				error: {
					code: "validation_error",
					message: "Invalid request",
					details: [{ field: "names.fr", message: "tag_name_taken" }],
				},
			},
		}));

		await user.type(await screen.findByLabelText("Français"), "Essence");
		await user.click(screen.getByRole("button", { name: "Create the tag" }));

		expect(
			await screen.findByText(
				"Another tag at the same level already has this name.",
			),
		).toBeVisible();
		expect(screen.getByLabelText("Français")).toBeInvalid();
		expect(screen.getByLabelText("English")).not.toBeInvalid();
		expect(onCreated).not.toHaveBeenCalled();
	});
});

describe("EditTagPage", () => {
	it("shows the tag's names and parent", async () => {
		renderEdit(gas.id);

		expect(await screen.findByLabelText("Français")).toHaveValue("Essence");
		expect(screen.getByLabelText("English")).toHaveValue("");
		expect(screen.getByLabelText("Parent tag")).toHaveValue(car.id);
	});

	it("adds a translation and keeps the other names, then leaves", async () => {
		const success = vi.spyOn(toast, "success").mockImplementation(() => "");
		const { user, onDone, writes } = renderEdit(gas.id);

		await user.type(await screen.findByLabelText("English"), "Gas");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
		expect(writes()).toEqual([
			{
				method: "PATCH",
				path: `${base}/${gas.id}`,
				body: { names: { en: "Gas", fr: "Essence" }, parentId: car.id },
			},
		]);
		expect(success).toHaveBeenCalledWith("The tag was saved.");
	});

	it("removes a translation by emptying its field", async () => {
		const { user, onDone, writes } = renderEdit(fiber.id);

		await user.clear(await screen.findByLabelText("Français"));
		await user.click(screen.getByRole("button", { name: "Save" }));

		await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
		expect(writes()).toMatchObject([{ body: { names: { en: "Fiber" } } }]);
	});

	it("moves the tag to the top", async () => {
		const { user, onDone, writes } = renderEdit(internet.id);

		await user.selectOptions(
			await screen.findByLabelText("Parent tag"),
			"None: at the top",
		);
		await user.click(screen.getByRole("button", { name: "Save" }));

		await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
		expect(writes()).toMatchObject([{ body: { parentId: null } }]);
	});

	it("doesn't offer the tag itself or its own sub-tags as parent", async () => {
		renderEdit(internet.id);

		expect(optionLabels(await screen.findByLabelText("Parent tag"))).toEqual([
			"None: at the top",
			"Car",
			"Car › Essence",
			"Home",
		]);
	});

	it("deletes the tag after a confirmation, then leaves", async () => {
		const success = vi.spyOn(toast, "success").mockImplementation(() => "");
		const { user, onDone, writes } = renderEdit(gas.id, () => ({
			status: 204,
		}));

		await user.click(
			await screen.findByRole("button", { name: "Delete the tag" }),
		);
		expect(writes()).toEqual([]);
		const dialog = within(
			screen.getByRole("alertdialog", { name: "Delete Essence?" }),
		);
		await user.click(dialog.getByRole("button", { name: "Delete" }));

		await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
		expect(writes()).toEqual([
			{ method: "DELETE", path: `${base}/${gas.id}`, body: undefined },
		]);
		expect(success).toHaveBeenCalledWith("The tag was deleted.");
	});

	it("says why a tag that has sub-tags can't be deleted, and stays", async () => {
		const error = vi.spyOn(toast, "error").mockImplementation(() => "");
		const { user, onDone } = renderEdit(home.id, () => ({
			status: 409,
			body: { error: { code: "tag_has_children", message: "Has child tags" } },
		}));

		await user.click(
			await screen.findByRole("button", { name: "Delete the tag" }),
		);
		await user.click(
			within(screen.getByRole("alertdialog")).getByRole("button", {
				name: "Delete",
			}),
		);

		await vi.waitFor(() =>
			expect(error).toHaveBeenCalledWith(
				"This tag has sub-tags: move or delete them first.",
			),
		);
		expect(onDone).not.toHaveBeenCalled();
	});

	it("says the page isn't found for a tag that no longer exists", async () => {
		renderEdit("00000000-0000-4000-8000-999999999999");

		expect(
			await screen.findByRole("heading", { name: "Page not found" }),
		).toBeVisible();
	});
});
