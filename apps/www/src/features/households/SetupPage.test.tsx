import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SetupPage } from "@/features/households/SetupPage";
import { setTestLocale } from "@/test/locale";
import { type ApiRequest, type ApiResponse, mockApi } from "@/test/mock-api";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

const NOW = "2026-11-14T12:00:00.000Z";

const household = {
	id: "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f",
	name: "The Tremblays",
	currency: "CAD",
	timeZone: "America/Toronto",
	expenseSharing: false,
	role: "owner",
	createdAt: NOW,
};

const invitation = {
	id: "9c8b7a6d-5e4f-4d3c-a2b1-0f9e8d7c6b5a",
	household: { id: household.id, name: "The Tremblays" },
	invitedByName: "Alice",
	expiresAt: NOW,
};

function invitationsPage(items: unknown[]): ApiResponse {
	return {
		status: 200,
		body: {
			data: items,
			pagination: { page: 1, pageSize: 20, total: items.length },
		},
	};
}

/** Answers the invitations list with `invitations`, and the rest with `respond`. */
function mockSetupApi(
	invitations: unknown[],
	respond: (request: ApiRequest) => ApiResponse | undefined = () => undefined,
) {
	const pending = [...invitations];
	return mockApi((request) => {
		if (request.method === "GET" && request.path === "/invitations") {
			return invitationsPage(pending);
		}
		if (request.path.endsWith("/decline")) {
			pending.length = 0;
		}
		return respond(request);
	});
}

/** The requests that change something, without the reads. */
const writes = (requests: ApiRequest[]) =>
	requests.filter((request) => request.method !== "GET");

describe("SetupPage", () => {
	it.each([
		["en", "Your household", "Create a household"],
		["fr", "Votre foyer", "Créer un foyer"],
		["es", "Tu hogar", "Crear un hogar"],
	] as const)(
		"offers to create a household, in %s",
		async (locale, title, createTitle) => {
			setTestLocale(locale);
			mockSetupApi([]);

			renderWithRouter(<SetupPage onReady={vi.fn()} />);

			expect(
				await screen.findByRole("heading", { level: 1, name: title }),
			).toBeVisible();
			expect(
				screen.getByRole("heading", { level: 2, name: createTitle }),
			).toBeVisible();
		},
	);

	it("creates a household in Canadian dollars by default, in the browser's time zone, then continues", async () => {
		const requests = mockSetupApi([], () => ({ status: 201, body: household }));
		const onReady = vi.fn();
		const user = userEvent.setup();
		renderWithRouter(<SetupPage onReady={onReady} />);

		await user.type(
			await screen.findByLabelText("Household name"),
			" The Tremblays ",
		);
		await user.click(
			screen.getByRole("button", { name: "Create the household" }),
		);

		await vi.waitFor(() => expect(onReady).toHaveBeenCalledOnce());
		expect(writes(requests)).toEqual([
			{
				method: "POST",
				path: "/households",
				body: {
					name: "The Tremblays",
					currency: "CAD",
					timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
				},
			},
		]);
	});

	it("creates a household in the currency chosen, named in the user's language", async () => {
		setTestLocale("fr");
		const requests = mockSetupApi([], () => ({
			status: 201,
			body: { ...household, currency: "EUR" },
		}));
		const onReady = vi.fn();
		const user = userEvent.setup();
		renderWithRouter(<SetupPage onReady={onReady} />);

		await user.type(await screen.findByLabelText("Nom du foyer"), "Maison");
		await user.selectOptions(
			screen.getByLabelText("Devise"),
			screen.getByRole("option", { name: "EUR · euro" }),
		);
		await user.click(screen.getByRole("button", { name: "Créer le foyer" }));

		await vi.waitFor(() => expect(onReady).toHaveBeenCalledOnce());
		expect(writes(requests)).toMatchObject([
			{ body: { name: "Maison", currency: "EUR" } },
		]);
	});

	it("asks for a name before calling the API", async () => {
		const requests = mockSetupApi([]);
		const onReady = vi.fn();
		const user = userEvent.setup();
		renderWithRouter(<SetupPage onReady={onReady} />);

		await user.click(
			await screen.findByRole("button", { name: "Create the household" }),
		);

		expect(
			await screen.findByText("Enter a name for the household."),
		).toBeVisible();
		expect(writes(requests)).toEqual([]);
		expect(onReady).not.toHaveBeenCalled();
	});

	it("shows the API's validation errors next to the field", async () => {
		mockSetupApi([], () => ({
			status: 422,
			body: {
				error: {
					code: "validation_error",
					message: "Invalid request",
					details: [{ field: "name", message: "household_name_too_long" }],
				},
			},
		}));
		const user = userEvent.setup();
		renderWithRouter(<SetupPage onReady={vi.fn()} />);

		await user.type(await screen.findByLabelText("Household name"), "Home");
		await user.click(
			screen.getByRole("button", { name: "Create the household" }),
		);

		expect(
			await screen.findByText(
				"The household's name is too long (60 characters at most).",
			),
		).toBeVisible();
	});

	it("shows no invitations section without invitations", async () => {
		mockSetupApi([]);

		renderWithRouter(<SetupPage onReady={vi.fn()} />);

		await screen.findByRole("heading", { level: 1 });
		expect(
			screen.queryByRole("region", { name: "Invitations" }),
		).not.toBeInTheDocument();
	});

	it("joins the household of an invitation, then continues", async () => {
		const requests = mockSetupApi([invitation], () => ({
			status: 200,
			body: { ...household, role: "member" },
		}));
		const onReady = vi.fn();
		const user = userEvent.setup();
		renderWithRouter(<SetupPage onReady={onReady} />);

		const invitations = await screen.findByRole("region", {
			name: "Invitations",
		});
		expect(
			within(invitations).getByText("Alice invites you to join The Tremblays."),
		).toBeVisible();
		await user.click(within(invitations).getByRole("button", { name: "Join" }));

		await vi.waitFor(() => expect(onReady).toHaveBeenCalledOnce());
		expect(writes(requests)).toEqual([
			{
				method: "POST",
				path: `/invitations/${invitation.id}/accept`,
				body: undefined,
			},
		]);
	});

	it("declines an invitation, which disappears, and stays on the page", async () => {
		const requests = mockSetupApi([invitation], () => ({ status: 204 }));
		const onReady = vi.fn();
		const user = userEvent.setup();
		renderWithRouter(<SetupPage onReady={onReady} />);

		await user.click(await screen.findByRole("button", { name: "Decline" }));

		await vi.waitFor(() =>
			expect(
				screen.queryByRole("region", { name: "Invitations" }),
			).not.toBeInTheDocument(),
		);
		expect(writes(requests)).toEqual([
			{
				method: "POST",
				path: `/invitations/${invitation.id}/decline`,
				body: undefined,
			},
		]);
		expect(onReady).not.toHaveBeenCalled();
		expect(screen.getByLabelText("Household name")).toBeVisible();
	});

	it("says when an invitation is no longer valid", async () => {
		mockSetupApi([invitation], () => ({
			status: 404,
			body: { error: { code: "not_found", message: "Invitation not found" } },
		}));
		const onReady = vi.fn();
		const user = userEvent.setup();
		renderWithRouter(<SetupPage onReady={onReady} />);

		await user.click(await screen.findByRole("button", { name: "Join" }));

		expect(
			await screen.findByText("This invitation is no longer valid."),
		).toBeVisible();
		expect(onReady).not.toHaveBeenCalled();
	});
});
