import type { SuggestedTag } from "@repo/schemas";
import { toast } from "@repo/ui";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SuggestedTagsPage } from "@/features/tags/SuggestedTagsPage";
import { base, household } from "@/features/tags/tag-test-data";
import { setTestLocale } from "@/test/locale";
import { type ApiResponse, mockApi } from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

afterEach(() => {
	vi.restoreAllMocks();
});

function suggestion(
	key: string,
	names: [string, string, string],
	children: SuggestedTag[] = [],
): SuggestedTag {
	const [en, fr, es] = names;
	return { key, names: { en, fr, es }, children };
}

const suggestions = [
	suggestion(
		"transport",
		["Transport", "Transport", "Transporte"],
		[
			suggestion(
				"transport/car",
				["Car", "Voiture", "Coche"],
				[
					suggestion("transport/car/gas", ["Gas", "Essence", "Gasolina"]),
					suggestion("transport/car/tires", ["Tires", "Pneus", "Neumáticos"]),
				],
			),
			suggestion("transport/train", ["Train", "Train", "Tren"]),
		],
	),
	suggestion(
		"pets",
		["Pets", "Animaux", "Mascotas"],
		[suggestion("pets/food", ["Food", "Nourriture", "Comida"])],
	),
];

function setUp(respond: () => ApiResponse = () => ({ status: 204 })) {
	const requests = mockApi((request) => {
		if (request.method === "GET" && request.path === `${base}/suggested`) {
			return { status: 200, body: { tags: suggestions } };
		}
		if (request.method === "POST") {
			return respond();
		}
		// The household's tags, refreshed once the suggestions are added
		return {
			status: 200,
			body: { data: [], pagination: { page: 1, pageSize: 500, total: 0 } },
		};
	});
	const onAdded = vi.fn();
	renderWithRouter(
		<SuggestedTagsPage household={household} onAdded={onAdded} />,
	);
	return {
		user: userEvent.setup(),
		onAdded,
		/** The keys sent to the API, sorted. */
		sentKeys: () =>
			requests
				.filter((request) => request.method === "POST")
				.map((request) =>
					[...(request.body as { keys: string[] }).keys].sort(),
				),
	};
}

const checkbox = (name: string) => screen.findByRole("checkbox", { name });

describe("SuggestedTagsPage", () => {
	it.each([
		["en", "Suggested tags", "Car", "Add the checked tags (7)"],
		["fr", "Tags suggérés", "Voiture", "Ajouter les tags cochés (7)"],
		["es", "Etiquetas sugeridas", "Coche", "Añadir las etiquetas marcadas (7)"],
	] as const)(
		"shows every suggestion checked, named in the user's language, in %s",
		async (locale, title, car, button) => {
			setTestLocale(locale);
			setUp();

			expect(
				await screen.findByRole("heading", { level: 1, name: title }),
			).toBeVisible();
			expect(await checkbox(car)).toBeChecked();
			expect(screen.getAllByRole("checkbox")).toHaveLength(7);
			expect(screen.getByRole("button", { name: button })).toBeEnabled();
		},
	);

	it("nests the suggestions under their parent", async () => {
		setUp();

		const tree = await screen.findByRole("list", { name: "Suggested tags" });
		const car = within(tree).getByText("Car").closest("li");

		expect(car).toContainElement(within(tree).getByText("Gas"));
		expect(car).not.toContainElement(within(tree).getByText("Train"));
	});

	it("adds every suggestion when nothing is unchecked, then continues", async () => {
		const success = vi.spyOn(toast, "success").mockImplementation(() => "");
		const { user, onAdded, sentKeys } = setUp();

		await user.click(
			await screen.findByRole("button", { name: "Add the checked tags (7)" }),
		);

		await vi.waitFor(() => expect(onAdded).toHaveBeenCalledOnce());
		expect(sentKeys()).toEqual([
			[
				"pets",
				"pets/food",
				"transport",
				"transport/car",
				"transport/car/gas",
				"transport/car/tires",
				"transport/train",
			],
		]);
		expect(success).toHaveBeenCalledWith("The tags were added.");
	});

	it("leaves out an unchecked tag, with everything under it", async () => {
		const { user, onAdded, sentKeys } = setUp();

		await user.click(await checkbox("Car"));

		expect(await checkbox("Gas")).not.toBeChecked();
		expect(await checkbox("Tires")).not.toBeChecked();
		expect(await checkbox("Transport")).toBeChecked();
		await user.click(
			screen.getByRole("button", { name: "Add the checked tags (4)" }),
		);
		await vi.waitFor(() => expect(onAdded).toHaveBeenCalledOnce());
		expect(sentKeys()).toEqual([
			["pets", "pets/food", "transport", "transport/train"],
		]);
	});

	it("leaves out a single unchecked tag, keeping its siblings", async () => {
		const { user, onAdded, sentKeys } = setUp();

		await user.click(await checkbox("Tires"));
		await user.click(
			screen.getByRole("button", { name: "Add the checked tags (6)" }),
		);

		await vi.waitFor(() => expect(onAdded).toHaveBeenCalledOnce());
		expect(sentKeys()[0]).not.toContain("transport/car/tires");
		expect(sentKeys()[0]).toContain("transport/car/gas");
	});

	it("checks a tag back with the tags above it", async () => {
		const { user } = setUp();

		await user.click(
			await screen.findByRole("button", { name: "Uncheck all" }),
		);
		await user.click(await checkbox("Gas"));

		expect(await checkbox("Car")).toBeChecked();
		expect(await checkbox("Transport")).toBeChecked();
		expect(await checkbox("Tires")).not.toBeChecked();
		expect(await checkbox("Pets")).not.toBeChecked();
		expect(
			screen.getByRole("button", { name: "Add the checked tags (3)" }),
		).toBeEnabled();
	});

	it("can't add nothing: unchecks all, then checks all again", async () => {
		const { user, sentKeys } = setUp();

		await user.click(
			await screen.findByRole("button", { name: "Uncheck all" }),
		);

		expect(
			screen.getByRole("button", { name: "Add the checked tags (0)" }),
		).toBeDisabled();
		await user.click(screen.getByRole("button", { name: "Check all" }));
		expect(
			screen.getByRole("button", { name: "Add the checked tags (7)" }),
		).toBeEnabled();
		expect(sentKeys()).toEqual([]);
	});

	it("says when the tags couldn't be added, and stays", async () => {
		const { user, onAdded } = setUp(() => ({
			status: 409,
			body: { error: { code: "tag_limit_reached", message: "Too many" } },
		}));

		await user.click(
			await screen.findByRole("button", { name: "Add the checked tags (7)" }),
		);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"The household has reached its maximum number of tags.",
		);
		expect(onAdded).not.toHaveBeenCalled();
	});
});
