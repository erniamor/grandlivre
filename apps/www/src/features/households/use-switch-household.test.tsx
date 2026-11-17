import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { HOUSEHOLD_COOKIE } from "@/features/households/preferred-household";
import { useSwitchHousehold } from "@/features/households/use-switch-household";
import { readCookie } from "@/lib/cookies";
import { renderWithRouter } from "@/test/render-with-router";

const GAGNONS = "9c8b7a6d-5e4f-4d3c-a2b1-0f9e8d7c6b5a";

afterEach(() => {
	// biome-ignore lint/suspicious/noDocumentCookie: clears the cookie the test wrote
	document.cookie = "household=; path=/; max-age=0";
});

function SwitchButton() {
	const switchHousehold = useSwitchHousehold();
	return (
		<button type="button" onClick={() => switchHousehold(GAGNONS)}>
			Switch
		</button>
	);
}

describe("useSwitchHousehold", () => {
	it("remembers the household on this device and opens its dashboard", async () => {
		const { router } = renderWithRouter(<SwitchButton />);

		await userEvent.setup().click(await screen.findByText("Switch"));

		expect(readCookie(document.cookie, HOUSEHOLD_COOKIE)).toBe(GAGNONS);
		await expect.poll(() => router.state.location.pathname).toBe("/dashboard");
	});
});
